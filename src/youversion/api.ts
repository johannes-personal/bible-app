import type { Book, ChapterData, ChapterRef, Translation } from '../api'
import { passageToChapter } from './html'

// YouVersion Platform API, reached through the /api/yv proxy that holds the app key.

/** Translation ids for YouVersion-only Bibles look like "yv-111". */
export const YV_PREFIX = 'yv-'

export const isYouVersionId = (id: string) => id.startsWith(YV_PREFIX)
export const youVersionNumber = (id: string) => Number(id.slice(YV_PREFIX.length))

/** A catalogue entry, as trimmed by the proxy. */
export interface YvBible {
  id: number
  abbreviation: string
  localized_abbreviation: string
  title: string
  localized_title: string
  language_tag: string
  /** Number of books. */
  books: number
}

interface YvBibleDetails {
  id: number
  abbreviation: string
  localized_abbreviation: string
  title: string
  localized_title: string
  language_tag: string
  copyright: string | null
  youversion_deep_link: string
}

interface YvIndex {
  text_direction: 'ltr' | 'rtl'
  books: {
    id: string
    title: string
    full_title?: string
    canon?: string
    chapters: { id: string; verses: unknown[] }[]
  }[]
}

const cache = new Map<string, Promise<unknown>>()

function get<T>(query: string): Promise<T> {
  let p = cache.get(query) as Promise<T> | undefined
  if (!p) {
    p = fetch(`/api/yv?${query}`).then((r) => {
      if (!r.ok) throw new Error(`YouVersion request failed (${r.status})`)
      return r.json() as Promise<T>
    })
    p.catch(() => cache.delete(query))
    cache.set(query, p)
  }
  return p
}

export const fetchYvCatalog = () => get<YvBible[]>('catalog=1')
const fetchDetails = (id: number) => get<YvBibleDetails>(`path=bibles/${id}`)
const fetchIndex = (id: number) => get<YvIndex>(`path=bibles/${id}/index`)

/** Chapters of a book in reading order, ignoring introductions and other non-numeric entries. */
const chapterNumbers = (book: YvIndex['books'][number]) =>
  book.chapters.map((c) => Number(c.id)).filter((n) => Number.isInteger(n))

/** Presents a catalogue entry like a Free Use Bible API translation. */
export function yvTranslation(b: YvBible | YvBibleDetails, textDirection: 'ltr' | 'rtl' = 'ltr'): Translation {
  const link = 'youversion_deep_link' in b ? b.youversion_deep_link : `https://www.bible.com/versions/${b.id}`
  return {
    id: `${YV_PREFIX}${b.id}`,
    name: b.localized_title || b.title,
    englishName: b.title,
    shortName: b.localized_abbreviation || b.abbreviation,
    language: b.language_tag,
    textDirection,
    website: link,
    licenseUrl: link,
    numberOfBooks: 'books' in b ? b.books : 0,
    source: 'youversion',
    youVersionId: b.id,
    copyright: 'copyright' in b ? (b.copyright ?? undefined) : undefined,
  }
}

export async function fetchYvBooks(translationId: string): Promise<Book[]> {
  const index = await fetchIndex(youVersionNumber(translationId))
  return index.books
    .map((b, i) => {
      const chapters = chapterNumbers(b)
      return {
        id: b.id,
        name: b.title,
        commonName: b.title,
        order: i + 1,
        numberOfChapters: chapters.length,
        firstChapterNumber: chapters[0] ?? 1,
      }
    })
    .filter((b) => b.numberOfChapters > 0)
}

export async function fetchYvChapter(ref: ChapterRef): Promise<ChapterData> {
  const id = youVersionNumber(ref.translationId)
  const passageId = `${ref.book}.${ref.chapter}`
  const [details, index, passage] = await Promise.all([
    fetchDetails(id),
    fetchIndex(id),
    get<{ content: string }>(`path=bibles/${id}/passages/${passageId}&format=html&include_headings=true&include_notes=true`),
  ])

  // Neighbouring chapters across book boundaries, in the Bible's own book order.
  const order = index.books.flatMap((b) => chapterNumbers(b).map((chapter) => ({ book: b.id, chapter })))
  const at = order.findIndex((c) => c.book === ref.book && c.chapter === ref.chapter)
  const neighbour = (i: number): ChapterRef | null =>
    at >= 0 && order[i] ? { translationId: ref.translationId, ...order[i] } : null

  const bookIndex = index.books.findIndex((b) => b.id === ref.book)
  const book = index.books[bookIndex]
  if (!book) throw new Error(`This translation doesn't include ${ref.book}`)
  const { content, footnotes } = passageToChapter(passage.content, ref.chapter)

  return {
    translation: yvTranslation(details, index.text_direction),
    book: {
      id: book.id,
      name: book.title,
      commonName: book.title,
      order: bookIndex + 1,
      numberOfChapters: chapterNumbers(book).length,
    },
    chapter: { number: ref.chapter, content, footnotes },
    numberOfVerses: content.filter((c) => c.type === 'verse').length,
    nextChapterReference: neighbour(at + 1),
    previousChapterReference: neighbour(at - 1),
    thisChapterAudioLinks: {},
    thisChapterAudioTimings: {},
  }
}
