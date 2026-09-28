// Client for the Free Use Bible API (https://bible.helloao.org).
// No API key needed, CORS is open, and responses are CDN cached.

const BASE = 'https://bible.helloao.org'

export interface Translation {
  id: string
  name: string
  englishName: string
  shortName: string
  language: string // ISO 639-3, e.g. "eng", "swe"
  languageName?: string
  languageEnglishName?: string
  textDirection: 'ltr' | 'rtl'
  website: string
  licenseUrl: string
  numberOfBooks: number
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

export async function fetchTranslations(): Promise<Translation[]> {
  const d = await getJson<{ translations: Translation[] }>('/api/available_translations.json')
  return d.translations
}

export async function fetchBooks(translationId: string): Promise<Book[]> {
  const d = await getJson<{ books: Book[] }>(`/api/${translationId}/books.json`)
  return d.books
}

export function fetchChapter(ref: ChapterRef): Promise<ChapterData> {
  return getJson<ChapterData>(`/api/${ref.translationId}/${ref.book}/${ref.chapter}.json`)
}

export function fetchAudioTimings(path: string): Promise<AudioTimings> {
  return getJson<AudioTimings>(path)
}
