// Bible data from three sources:
// - The Free Use Bible API (https://bible.helloao.org): no key, CORS open, CDN cached.
//   Includes recorded narration with verse timings for some translations.
// - YouVersion (see ./youversion), reached through a server-side proxy that holds the key.
// - Bible Brain (see ./biblebrain), also through a proxy: recorded narration, and a few
//   translations of its own that come with it.
// YouVersion takes precedence: its translations get ids like "yv-111", including those both
// sources carry. For those, the Free Use Bible API adds recorded narration and stands in
// when YouVersion can't be reached. Translations only it has keep its ids (e.g. "eng_kjv").
// Bible Brain's own translations get ids like "bb-NLDHSV".

import {
  BB_TIMINGS,
  fetchBbAudio,
  fetchBbBooks,
  fetchBbCatalog,
  fetchBbChapter,
  fetchBbTimings,
  isBibleBrainId,
} from './biblebrain/api'
import { addBibleBrain } from './biblebrain/merge'
import { fetchYvBooks, fetchYvCatalog, fetchYvChapter, isYouVersionId } from './youversion/api'
import { mergeCatalogs } from './youversion/merge'
import { toChapterCrossRefs, type ChapterCrossRefs, type CrossRef } from './crossrefs'

const BASE = 'https://bible.helloao.org'

export interface Translation {
  id: string
  name: string
  englishName: string
  shortName: string
  /** ISO 639-3 ("swe") for the Free Use Bible API, BCP 47 ("sv") for YouVersion. */
  language: string
  languageName?: string
  languageEnglishName?: string
  textDirection: 'ltr' | 'rtl'
  website: string
  licenseUrl: string
  numberOfBooks: number
  /** Where the text comes from; absent means the Free Use Bible API. */
  source?: 'youversion' | 'biblebrain'
  /** The YouVersion Bible this text comes from. */
  youVersionId?: number
  /** The same translation's Free Use Bible API id, when that source carries it too. */
  freeId?: string
  /** The Bible Brain Bible with recorded narration of this translation (or its text, for "bb-" ids). */
  bibleBrainId?: string
  /** Copyright notice to show with the text (YouVersion). */
  copyright?: string
}

export interface Book {
  id: string // USFM code, e.g. "GEN", "JHN"
  name: string
  commonName: string
  order: number
  numberOfChapters: number
  firstChapterNumber?: number
}

export interface FormattedText {
  text: string
  poem?: number
  wordsOfJesus?: boolean
}

export type VerseContent =
  | string
  | FormattedText
  | { heading: string }
  | { lineBreak: true }
  | { noteId: number }

export type ChapterItem =
  | { type: 'heading'; content: string[] }
  | { type: 'hebrew_subtitle'; content: VerseContent[] }
  | { type: 'line_break' }
  | { type: 'verse'; number: number; content: VerseContent[] }

export interface Footnote {
  noteId: number
  text: string
  caller: string | null
  reference?: { chapter: number; verse: number }
}

export interface ChapterRef {
  translationId: string
  book: string
  chapter: number
  /** A verse to scroll to, e.g. when following a reference. */
  verse?: number
  /** The verse is a saved reading position to resume at, rather than a link target. */
  resume?: boolean
}

export interface ChapterData {
  translation: Translation
  book: Book
  chapter: { number: number; content: ChapterItem[]; footnotes: Footnote[] }
  numberOfVerses: number
  nextChapterReference: ChapterRef | null
  previousChapterReference: ChapterRef | null
  /** Narrator name -> mp3 URL. */
  thisChapterAudioLinks: Record<string, string>
  /** Narrator name -> API path of per-verse timings JSON. */
  thisChapterAudioTimings: Record<string, string>
}

export interface AudioTimings {
  /** Start time in seconds of each verse, in chapter order. */
  verses: number[]
}

const cache = new Map<string, Promise<unknown>>()

function getJson<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined
  if (!p) {
    p = fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`Request failed (${r.status})`)
      return r.json() as Promise<T>
    })
    // Don't keep failed requests around, so a retry refetches.
    p.catch(() => cache.delete(path))
    cache.set(path, p)
  }
  return p
}

let catalog: Promise<Translation[]> | undefined
let youVersionMissing = false

/** Whether the last catalogue load had to leave out YouVersion (outage, no key, local dev). */
export const youVersionUnavailable = () => youVersionMissing

/**
 * Translations from all sources, merged. If YouVersion can't be reached this is just the
 * Free Use Bible API list, and isn't remembered: the next call tries YouVersion again.
 * Bible Brain is optional: without it there's just no extra narration.
 */
export function fetchTranslations(): Promise<Translation[]> {
  if (!catalog) {
    const free = getJson<{ translations: Translation[] }>('/api/available_translations.json').then((d) => d.translations)
    const yv = fetchYvCatalog().then(
      (list) => ({ list, ok: true }),
      () => ({ list: [], ok: false }),
    )
    const bb = fetchBbCatalog().catch(() => [])
    const merged = Promise.all([free, yv, bb]).then(([f, y, b]) => {
      youVersionMissing = !y.ok
      if (!y.ok && catalog === merged) catalog = undefined
      return addBibleBrain(mergeCatalogs(f, y.list), b)
    })
    merged.catch(() => {
      if (catalog === merged) catalog = undefined
    })
    catalog = merged
  }
  return catalog
}

/** The merged catalogue entry for a translation id; also finds YouVersion entries by their old Free Use Bible API id. */
export function findTranslation(list: Translation[] | null | undefined, id: string): Translation | undefined {
  return list?.find((t) => t.id === id) ?? list?.find((t) => t.freeId === id)
}

/** The catalogue entry for a translation id, or undefined if the catalogue can't be loaded. */
const entryOf = (translationId: string) =>
  fetchTranslations().then(
    (list) => findTranslation(list, translationId),
    () => undefined,
  )
const freeIdOf = (translationId: string) => entryOf(translationId).then((t) => t?.freeId)

const fetchFreeBooks = (id: string) => getJson<{ books: Book[] }>(`/api/${id}/books.json`).then((d) => d.books)
const fetchFreeChapter = (id: string, ref: ChapterRef) => getJson<ChapterData>(`/api/${id}/${ref.book}/${ref.chapter}.json`)

export async function fetchBooks(translationId: string): Promise<Book[]> {
  if (isBibleBrainId(translationId)) return fetchBbBooks(translationId)
  if (!isYouVersionId(translationId)) return fetchFreeBooks(translationId)
  try {
    return await fetchYvBooks(translationId)
  } catch (e) {
    const freeId = await freeIdOf(translationId)
    if (!freeId) throw e
    return fetchFreeBooks(freeId)
  }
}

/** A chapter with every narration available for it: the text source's own, plus Bible Brain's. */
export async function fetchChapter(ref: ChapterRef): Promise<ChapterData> {
  if (isBibleBrainId(ref.translationId)) return fetchBbChapter(ref)
  const [data, entry] = await Promise.all([fetchChapterText(ref), entryOf(ref.translationId)])
  const bibleId = entry?.bibleBrainId
  const audio = bibleId ? await fetchBbAudio(bibleId, ref.book, ref.chapter).catch(() => null) : null
  if (!audio) return data
  return {
    ...data,
    thisChapterAudioLinks: { ...data.thisChapterAudioLinks, ...audio.links },
    thisChapterAudioTimings: { ...data.thisChapterAudioTimings, ...audio.timings },
  }
}

async function fetchChapterText(ref: ChapterRef): Promise<ChapterData> {
  if (!isYouVersionId(ref.translationId)) return fetchFreeChapter(ref.translationId, ref)
  const [yv, free] = await Promise.all([
    fetchYvChapter(ref).then(
      (data) => ({ data, error: null }),
      (error: Error) => ({ data: null, error }),
    ),
    freeIdOf(ref.translationId).then((id) => (id ? fetchFreeChapter(id, ref).catch(() => null) : null)),
  ])
  if (yv.data) {
    // Recorded narration from the Free Use Bible API, when its verses line up with YouVersion's.
    if (!free || free.numberOfVerses !== yv.data.numberOfVerses) return yv.data
    return { ...yv.data, thisChapterAudioLinks: free.thisChapterAudioLinks, thisChapterAudioTimings: free.thisChapterAudioTimings }
  }
  if (!free) throw yv.error
  // YouVersion is unavailable: read the same translation from the Free Use Bible API, under the YouVersion id.
  const asYv = (r: ChapterRef | null) => r && { ...r, translationId: ref.translationId }
  return {
    ...free,
    translation: { ...free.translation, id: ref.translationId },
    nextChapterReference: asYv(free.nextChapterReference),
    previousChapterReference: asYv(free.previousChapterReference),
  }
}

/** Cross references for a chapter (OpenBible.info, via the Free Use Bible API). */
export async function fetchCrossRefs(book: string, chapter: number): Promise<ChapterCrossRefs> {
  const d = await getJson<{ chapter: { content: { verse: number; references: CrossRef[] }[] } }>(
    `/api/d/open-cross-ref/${book}/${chapter}.json`,
  )
  return toChapterCrossRefs(book, chapter, d.chapter.content)
}

export function fetchAudioTimings(path: string): Promise<AudioTimings> {
  if (path.startsWith(BB_TIMINGS)) return fetchBbTimings(path)
  return getJson<AudioTimings>(path)
}
