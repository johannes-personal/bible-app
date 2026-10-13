import type { ReactNode } from 'react'
import { fetchChapter, type Book, type Footnote } from '../api'
import { parseChapter } from '../content'
import { useAsync } from '../hooks'
import { referenceLabel, type Reference, type ReferenceFinder, type VerseRange } from '../references'
import { hashFor } from '../route'
import { Popover } from './Popover'

interface Context {
  translationId: string
  /** The chapter's book, for references like "(see 12:25)". */
  bookId: string
  books: Book[]
  finder: ReferenceFinder
}

const MAX_QUOTES = 3

const linkFor = (ref: VerseRange, translationId: string) =>
  hashFor({ translationId, book: ref.book, chapter: ref.chapter, verse: ref.verseStart })

/** Note text with every Bible reference in it turned into a link to that verse. */
export function NoteText({ text, translationId, bookId, finder, onNavigate }: Omit<Context, 'books'> & {
  text: string
  onNavigate?: () => void
}) {
  const refs = finder.find(text, bookId)
  const out: ReactNode[] = []
  let at = 0
  refs.forEach((r, i) => {
    out.push(text.slice(at, r.start))
    out.push(
      <a key={i} className="ref-link" href={linkFor(r, translationId)} onClick={onNavigate}>
        {text.slice(r.start, r.end)}
      </a>,
    )
    at = r.end
  })
  out.push(text.slice(at))
  return <>{out}</>
}

/** The referenced verses, read from the current translation, with a link to them. */
export function Quote({ reference, translationId, books, onNavigate }: Omit<Context, 'finder' | 'bookId'> & {
  reference: VerseRange
  onNavigate: () => void
}) {
  const chapterRef = { translationId, book: reference.book, chapter: reference.chapter }
  const { data, error, loading } = useAsync(hashFor(chapterRef), () => fetchChapter(chapterRef))
  const verses =
    data && !loading
      ? parseChapter(data.chapter.content).verses.filter(
          (v) => v.number >= reference.verseStart && v.number <= reference.verseEnd,
        )
      : []

  return (
    <figure className="quote">
      <figcaption>
        <a href={linkFor(reference, translationId)} onClick={onNavigate}>
          {referenceLabel(reference, books)} →
        </a>
      </figcaption>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="muted">Not available in this translation.</p>}
      {!loading && !error && verses.length === 0 && <p className="muted">Verse not found in this translation.</p>}
      {verses.length > 0 && (
        <blockquote>
          {verses.map((v) => (
            <span key={v.number}>
              {verses.length > 1 && <sup className="vnum">{v.number}</sup>}
              {v.text}{' '}
            </span>
          ))}
        </blockquote>
      )}
    </figure>
  )
}

/** Whether a note is nothing but references (like "Deuteronomy 8:3"), which the quotes already show. */
function onlyReferences(text: string, refs: Reference[]) {
  if (!refs.length) return false
  let rest = text
  for (const r of [...refs].reverse()) rest = rest.slice(0, r.start) + rest.slice(r.end)
  return /^[\s.,;:–—-]*(and|och|&)?[\s.,;:–—-]*$/i.test(rest.replace(/\b(and|och)\b/gi, ''))
}

/**
 * A footnote marker. Hovering (or tapping, on touch screens) opens a popover with the
 * note; references in it show the full verse text and link to the verse in the reader.
 */
export function NoteRef({ note, caller, translationId, bookId, books, finder }: Context & { note: Footnote; caller: string }) {
  const refs = finder.find(note.text, bookId)
  return (
    <Popover className="note-ref" label={`Footnote ${caller}`} trigger={caller}>
      {(close) => (
        <>
          {!onlyReferences(note.text, refs) && (
            <p className="note-text">
              <NoteText text={note.text} translationId={translationId} bookId={bookId} finder={finder} onNavigate={close} />
            </p>
          )}
          {refs.slice(0, MAX_QUOTES).map((r, i) => (
            <Quote key={i} reference={r} translationId={translationId} books={books} onNavigate={close} />
          ))}
        </>
      )}
    </Popover>
  )
}
