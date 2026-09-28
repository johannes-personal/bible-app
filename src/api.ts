// Bible data from two sources:
// - The Free Use Bible API (https://bible.helloao.org): no key, CORS open, CDN cached.
//   Includes recorded narration with verse timings for some translations.
// - YouVersion (see ./youversion), reached through a server-side proxy that holds the key.
// Translations only YouVersion has get ids like "yv-111"; everything else uses Free Use
// Bible API ids, including translations both sources carry.

import { fetchYvBooks, fetchYvCatalog, fetchYvChapter, isYouVersionId } from './youversion/api'
import { mergeCatalogs } from './youversion/merge'

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
  source?: 'youversion'
  /** The matching YouVersion Bible, when YouVersion carries this translation too. */
  youVersionId?: number
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

/**
 * Translations from both sources, merged. If YouVersion is unavailable (no key, outage,
 * or local development without the proxy) this is just the Free Use Bible API list.
 */
export function fetchTranslations(): Promise<Translation[]> {
  if (!catalog) {
    const free = getJson<{ translations: Translation[] }>('/api/available_translations.json').then((d) => d.translations)
    const yv = fetchYvCatalog().catch(() => [])
    catalog = Promise.all([free, yv]).then(([f, y]) => mergeCatalogs(f, y))
    catalog.catch(() => (catalog = undefined))
  }
  return catalog
}

export async function fetchBooks(translationId: string): Promise<Book[]> {
  if (isYouVersionId(translationId)) return fetchYvBooks(translationId)
  const d = await getJson<{ books: Book[] }>(`/api/${translationId}/books.json`)
  return d.books
}

export function fetchChapter(ref: ChapterRef): Promise<ChapterData> {
  if (isYouVersionId(ref.translationId)) return fetchYvChapter(ref)
  return getJson<ChapterData>(`/api/${ref.translationId}/${ref.book}/${ref.chapter}.json`)
}

export function fetchAudioTimings(path: string): Promise<AudioTimings> {
  return getJson<AudioTimings>(path)
}
