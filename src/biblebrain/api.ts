import type { Book, ChapterData, ChapterItem, ChapterRef, Translation } from '../api'
import { toBcp47 } from '../lang'

// Bible Brain (Faith Comes By Hearing), reached through the /api/bb proxy that holds the key.
// It adds recorded narration (often with per-verse timings) to translations the other sources
// carry, and a few translations of its own that come with narration, such as the Herziene
// Statenvertaling and Svenska Folkbibeln 2015.

/** Translation ids for Bible Brain-only Bibles look like "bb-NLDHSV". */
export const BB_PREFIX = 'bb-'

export const isBibleBrainId = (id: string) => id.startsWith(BB_PREFIX)
const bibleIdOf = (translationId: string) => translationId.slice(BB_PREFIX.length)

/** A usable fileset, as trimmed by the proxy (see api/bb.ts). */
export interface BbFileset {
  id: string
  type: 'text_plain' | 'audio' | 'audio_drama'
  /** "C" (complete), "NT", "OT", "NTP" (partial NT), "NTOTP"… */
  size: string
  /** Has per-verse audio timestamps. */
  timed?: boolean
}

/** A catalogue entry, as trimmed by the proxy. */
export interface BbBible {
  /** Bible id, e.g. "NLDHSV": ISO 639-3 language code plus a version code. */
  id: string
  name: string
  /** Name in the Bible's own language. */
  vname?: string
  language: string
  autonym?: string
  iso: string
  filesets: BbFileset[]
}

interface BbBookInfo {
  book_id: string
  name: string
  testament?: string
  book_order?: number
  chapters: number[]
}

interface BbVerse {
  book_id: string
  chapter: number
  verse_start: number
  verse_end?: number | null
  verse_text: string
}

interface BbTimestamp {
  verse_start: string
  timestamp: number
}

const cache = new Map<string, Promise<unknown>>()

function get<T>(query: string): Promise<T> {
  let p = cache.get(query) as Promise<T> | undefined
  if (!p) {
    p = fetch(`/api/bb?${query}`).then((r) => {
      // Without the proxy (e.g. local development) the request falls through to index.html.
      const json = r.headers.get('Content-Type')?.includes('json')
      if (!r.ok || !json) throw new Error("Bible Brain can't be reached right now.")
      return r.json() as Promise<T>
    })
    p.catch(() => cache.delete(query))
    cache.set(query, p)
  }
  return p
}

export const fetchBbCatalog = () => get<BbBible[]>('catalog=1')

const fetchBookInfo = (bibleId: string) =>
  get<{ data: BbBookInfo[] }>(`path=bibles/${bibleId}/book&verify_content=true`).then((d) => d.data)

const fetchDetails = (bibleId: string) =>
  get<{ data: { mark?: string | null; name?: string } }>(`path=bibles/${bibleId}`).then((d) => d.data)

const NT_BOOKS = new Set(
  'MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' '),
)

/** Whether a fileset's size code covers a book: "C" covers all, "NT"/"NTP" the New Testament… */
export function coversBook(size: string, book: string): boolean {
  if (size === 'C') return true
  const testament = NT_BOOKS.has(book) ? 'NT' : 'OT'
  return size.includes(testament)
}

/** Filesets of the given types covering a book: complete before partial, then timed before untimed. */
export function filesetsFor(bible: BbBible, book: string, types: BbFileset['type'][]): BbFileset[] {
  const rank = (f: BbFileset) => (f.size.includes('P') ? 2 : 0) + (f.timed ? 0 : 1)
  return bible.filesets.filter((f) => types.includes(f.type) && coversBook(f.size, book)).sort((a, b) => rank(a) - rank(b))
}

const hasText = (b: BbBible) => b.filesets.some((f) => f.type === 'text_plain')
export const hasAudio = (b: BbBible) => b.filesets.some((f) => f.type !== 'text_plain')
export const hasTextAndAudio = (b: BbBible) => hasText(b) && hasAudio(b)

// Short names for Bibles whose id doesn't give a familiar abbreviation.
const SHORT_NAMES: Record<string, string> = {
  NLDHSV: 'HSV',
  NLDNBV: 'NBV',
  SWESFB: 'SFB98',
  SWESFV: 'SFB15',
}

/** "HSV" from "Herziene Statenvertaling (HSV)", else the id without its language code. */
export function shortNameOf(b: BbBible): string {
  return SHORT_NAMES[b.id] ?? /\(([\p{Lu}\d]{2,8})\)\s*$/u.exec(b.name)?.[1] ?? b.id.replace(/^[A-Z]{3}(?=[A-Z0-9]{2,})/, '')
}

const RTL = new Set(['ar', 'arc', 'ckb', 'dv', 'fa', 'he', 'ps', 'sd', 'syr', 'ug', 'ur', 'yi'])

function directionOf(iso: string): 'ltr' | 'rtl' {
  const tag = toBcp47(iso) ?? iso
  return RTL.has(tag.split('-')[0]) ? 'rtl' : 'ltr'
}

/** "Herziene Statenvertaling (HSV)" -> "Herziene Statenvertaling": the abbreviation is shown separately. */
const withoutAbbreviation = (name: string) => name.replace(/\s*\([\p{Lu}\d]{2,8}\)\s*$/u, '')

/** Presents a catalogue entry like a Free Use Bible API translation. */
export function bbTranslation(b: BbBible, copyright?: string): Translation {
  const link = `https://live.bible.is/bible/${b.id}`
  return {
    id: `${BB_PREFIX}${b.id}`,
    name: withoutAbbreviation(b.vname || b.name),
    englishName: withoutAbbreviation(b.name),
    shortName: shortNameOf(b),
    language: b.iso,
    languageName: b.autonym,
    languageEnglishName: b.language,
    textDirection: directionOf(b.iso),
    website: link,
    licenseUrl: link,
    numberOfBooks: 0,
    source: 'biblebrain',
    bibleBrainId: b.id,
    copyright,
  }
}

async function bibleOf(bibleId: string): Promise<BbBible> {
  const bible = (await fetchBbCatalog()).find((b) => b.id === bibleId)
  if (!bible) throw new Error('This Bible is no longer available from Bible Brain.')
  return bible
}

export async function fetchBbBooks(translationId: string): Promise<Book[]> {
  const books = await fetchBookInfo(bibleIdOf(translationId))
  return books
    .filter((b) => b.chapters?.length)
    .map((b, i) => ({
      id: b.book_id,
      name: b.name,
      commonName: b.name,
      order: i + 1,
      numberOfChapters: b.chapters.length,
      firstChapterNumber: b.chapters[0],
    }))
}

/** Plain-text verses as chapter content: one paragraph, verse by verse. */
export function versesToContent(verses: BbVerse[]): ChapterItem[] {
  return verses
    .filter((v) => v.verse_text?.trim())
    .sort((a, b) => a.verse_start - b.verse_start)
    .map((v) => ({ type: 'verse', number: Number(v.verse_start), content: [v.verse_text.trim()] }))
}

export async function fetchBbChapter(ref: ChapterRef): Promise<ChapterData> {
  const bibleId = bibleIdOf(ref.translationId)
  const [bible, books, details] = await Promise.all([
    bibleOf(bibleId),
    fetchBookInfo(bibleId),
    fetchDetails(bibleId).catch(() => null),
  ])
  const bookIndex = books.findIndex((b) => b.book_id === ref.book)
  const book = books[bookIndex]
  if (!book) throw new Error(`This translation doesn't include ${ref.book}`)

  // The first text fileset that has this chapter.
  let verses: BbVerse[] = []
  for (const f of filesetsFor(bible, ref.book, ['text_plain'])) {
    const d = await get<{ data: BbVerse[] }>(`path=bibles/filesets/${f.id}/${ref.book}/${ref.chapter}`).catch(() => null)
    if (d?.data?.length) {
      verses = d.data
      break
    }
  }
  if (!verses.length) throw new Error("This chapter isn't available in this translation.")
  const content = versesToContent(verses)

  // Neighbouring chapters across book boundaries, in the Bible's own book order.
  const order = books.flatMap((b) => (b.chapters ?? []).map((chapter) => ({ book: b.book_id, chapter })))
  const at = order.findIndex((c) => c.book === ref.book && c.chapter === ref.chapter)
  const neighbour = (i: number): ChapterRef | null =>
    at >= 0 && order[i] ? { translationId: ref.translationId, ...order[i] } : null

  const audio = bibleBrainAudio(bible, ref.book, ref.chapter)
  return {
    translation: bbTranslation(bible, details?.mark ?? undefined),
    book: {
      id: book.book_id,
      name: book.name,
      commonName: book.name,
      order: bookIndex + 1,
      numberOfChapters: book.chapters.length,
    },
    chapter: { number: ref.chapter, content, footnotes: [] },
    numberOfVerses: content.length,
    nextChapterReference: neighbour(at + 1),
    previousChapterReference: neighbour(at - 1),
    thisChapterAudioLinks: audio.links,
    thisChapterAudioTimings: audio.timings,
  }
}

/** Narrator names Bible Brain recordings are listed under in the player. */
export const BB_NARRATOR = 'Faith Comes By Hearing'
export const BB_DRAMA_NARRATOR = 'Faith Comes By Hearing (dramatized)'

/** Prefix of timing paths that come from Bible Brain rather than the Free Use Bible API. */
export const BB_TIMINGS = 'bb:'

/**
 * Narration for a chapter: the first plain and the first dramatized recording that cover the
 * book. Links go through the proxy, which redirects to a fresh signed mp3 link on each load.
 */
export function bibleBrainAudio(bible: BbBible, book: string, chapter: number) {
  const links: Record<string, string> = {}
  const timings: Record<string, string> = {}
  for (const f of filesetsFor(bible, book, ['audio', 'audio_drama'])) {
    const narrator = f.type === 'audio_drama' ? BB_DRAMA_NARRATOR : BB_NARRATOR
    if (links[narrator]) continue
    const ref = `${f.id}/${book}/${chapter}`
    links[narrator] = `/api/bb?audio=${ref}`
    timings[narrator] = `${BB_TIMINGS}${ref}`
  }
  return { links, timings }
}

/** Narration for a translation another source carries, from the Bible Brain Bible it was matched with. */
export async function fetchBbAudio(bibleId: string, book: string, chapter: number) {
  return bibleBrainAudio(await bibleOf(bibleId), book, chapter)
}

/**
 * Start times of the verses, in verse order, from Bible Brain timestamps. Entries before
 * verse 1 (a spoken chapter heading) are dropped, so index 0 is verse 1.
 */
export function toVerseStarts(stamps: BbTimestamp[]): number[] {
  const byVerse = new Map<number, number>()
  for (const s of stamps) {
    const verse = parseInt(s.verse_start, 10)
    if (verse >= 1 && !byVerse.has(verse)) byVerse.set(verse, Number(s.timestamp))
  }
  return [...byVerse.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t)
}

/** Per-verse timings for a "bb:FILESET/BOOK/CHAPTER" timing path. */
export async function fetchBbTimings(path: string): Promise<{ verses: number[] }> {
  const d = await get<{ data: BbTimestamp[] }>(`path=timestamps/${path.slice(BB_TIMINGS.length)}`)
  const verses = toVerseStarts(d.data ?? [])
  if (!verses.length) throw new Error('No timings for this chapter')
  return { verses }
}
