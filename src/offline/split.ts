import type { ChapterItem, Footnote, Translation } from '../api'

// The Free Use Bible API serves a translation's whole text as one file (…/complete.json).
// Saving a translation for offline reading fetches that file once and splits it into the
// answers the app would otherwise ask for one at a time: the list of books and each chapter.

export interface CompleteTranslation {
  translation: Translation
  books: {
    id: string
    name: string
    commonName: string
    order: number
    numberOfChapters: number
    chapters: {
      numberOfVerses: number
      thisChapterAudioLinks?: Record<string, string>
      /** Per narrator; here the timings themselves, where a chapter's answer has links to them. */
      thisChapterAudioTimings?: Record<string, unknown>
      chapter: { number: number; content: ChapterItem[]; footnotes: Footnote[] }
    }[]
  }[]
}

export interface SplitFile {
  /** The path the app asks the API for, e.g. "/api/BSB/JHN/3.json". */
  path: string
  body: unknown
}

export function splitTranslation({ translation, books }: CompleteTranslation): SplitFile[] {
  const id = translation.id
  const link = (book: string, chapter: number) => `/api/${id}/${book}/${chapter}.json`
  const reference = (book: string, chapter: number) => ({ translationId: id, book, chapter })

  const ordered = books.filter((b) => b.chapters.length > 0).sort((a, b) => a.order - b.order)
  const info = new Map(
    ordered.map(({ chapters, ...book }) => {
      const first = chapters[0].chapter.number
      const last = chapters[chapters.length - 1].chapter.number
      return [
        book.id,
        {
          ...book,
          translationId: id,
          firstChapterNumber: first,
          firstChapterApiLink: link(book.id, first),
          firstChapterReference: reference(book.id, first),
          lastChapterNumber: last,
          lastChapterApiLink: link(book.id, last),
          lastChapterReference: reference(book.id, last),
        },
      ]
    }),
  )

  const files: SplitFile[] = [{ path: `/api/${id}/books.json`, body: { translation, books: ordered.map((b) => info.get(b.id)) } }]

  // Every chapter in reading order, so each knows the one before and after it (also across books).
  const all = ordered.flatMap((book) => book.chapters.map((entry) => ({ book: book.id, number: entry.chapter.number, entry })))
  all.forEach(({ book, number, entry }, i) => {
    const next = all[i + 1]
    const previous = all[i - 1]
    files.push({
      path: link(book, number),
      body: {
        translation,
        book: info.get(book),
        chapter: entry.chapter,
        thisChapterLink: link(book, number),
        thisChapterReference: reference(book, number),
        thisChapterAudioLinks: entry.thisChapterAudioLinks ?? {},
        nextChapterApiLink: next ? link(next.book, next.number) : null,
        nextChapterReference: next ? reference(next.book, next.number) : null,
        previousChapterApiLink: previous ? link(previous.book, previous.number) : null,
        previousChapterReference: previous ? reference(previous.book, previous.number) : null,
        thisChapterAudioTimings: Object.fromEntries(
          Object.keys(entry.thisChapterAudioTimings ?? {}).map((narrator) => [
            narrator,
            `/api/${id}/${book}/${number}.${narrator}.audioTimings.json`,
          ]),
        ),
        numberOfVerses: entry.numberOfVerses,
      },
    })
  })
  return files
}
