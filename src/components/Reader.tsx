import { memo, useMemo, type ReactNode } from 'react'
import type { Book, Footnote } from '../api'
import type { Block, Part, VerseBlock } from '../content'
import { referenceFinder } from '../references'
import { NoteRef, NoteText } from './NotePopover'

interface Props {
  title: string
  blocks: Block[]
  footnotes: Footnote[]
  dir: 'ltr' | 'rtl'
  lang?: string
  /** Verse being read aloud, or -1. */
  currentIndex: number
  onVerseClick?: (index: number) => void
  /** Used to resolve and show references in footnotes. */
  translationId: string
  bookId: string
  books: Book[]
}

const noteCaller = (i: number) => String.fromCharCode(97 + (i % 26)) // a, b, c…

// Parts are separate strings in the source, so spaces go between them, except around
// punctuation that attaches to a word and where the text already has whitespace.
const CLOSING = /^[\s”’"'»),.;:!?\]]/
const OPENING = /[\s“‘«„([]$/
const spaceAfter = (part: Part & { kind: 'text' }, next: Part | undefined) =>
  !OPENING.test(part.text) && !(next?.kind === 'text' && CLOSING.test(next.text))

export const Reader = memo(function Reader({
  title,
  blocks,
  footnotes,
  dir,
  lang,
  currentIndex,
  onVerseClick,
  translationId,
  bookId,
  books,
}: Props) {
  const finder = useMemo(() => referenceFinder(books), [books])
  // USFM callers "+" (generate one) and "-" (none) both get a letter here, so every note is clickable.
  const callers = new Map(
    footnotes.map((f, i) => [f.noteId, f.caller && f.caller !== '+' && f.caller !== '-' ? f.caller : noteCaller(i)]),
  )
  const notes = new Map(footnotes.map((f) => [f.noteId, f]))

  const noteRef = (noteId: number) => {
    const note = notes.get(noteId)
    if (!note) return null
    return (
      <NoteRef
        key={`n${noteId}`}
        note={note}
        caller={callers.get(noteId) ?? ''}
        translationId={translationId}
        bookId={bookId}
        books={books}
        finder={finder}
      />
    )
  }

  const renderPart = (p: Part, i: number, parts: Part[]): ReactNode => {
    switch (p.kind) {
      case 'text': {
        const cls = [p.poem ? `line poem-${Math.min(p.poem, 3)}` : '', p.jesus ? 'jesus' : '']
          .filter(Boolean)
          .join(' ')
        return (
          <span key={i} className={cls || undefined}>
            {p.text}
            {p.notes?.map(noteRef)}
            {spaceAfter(p, parts[i + 1]) && ' '}
          </span>
        )
      }
      case 'break':
        return <br key={i} />
      case 'heading':
        return (
          <span key={i} className="inline-heading">
            {p.text}
          </span>
        )
      case 'note':
        return noteRef(p.noteId)
    }
  }

  const renderVerse = (v: VerseBlock) => (
    <span
      key={v.index}
      className={`verse${v.index === currentIndex ? ' current' : ''}${onVerseClick ? ' clickable' : ''}`}
      data-index={v.index}
      id={`v${v.number}`}
      onClick={onVerseClick ? () => onVerseClick(v.index) : undefined}
    >
      <sup className="vnum">{v.number}</sup>
      {v.parts.map(renderPart)}
    </span>
  )

  return (
    <article className="reader" dir={dir} lang={lang}>
      <h1 className="chapter-title">{title}</h1>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <h2 key={i} className="section-heading">
                {b.text}
              </h2>
            )
          case 'subtitle':
            return (
              <p key={i} className="subtitle">
                {b.parts.map(renderPart)}
              </p>
            )
          case 'para':
            return (
              <p key={i} className={b.poetry ? 'para poetry' : 'para'}>
                {b.verses.map(renderVerse)}
              </p>
            )
        }
      })}
      {footnotes.length > 0 && (
        <aside className="footnotes">
          <h2>Notes</h2>
          <ol>
            {footnotes.map((f) => (
              <li key={f.noteId} id={`fn-${f.noteId}`}>
                <span className="note-caller">{callers.get(f.noteId)}</span>
                {f.reference && <span className="note-ref-label">{f.reference.chapter}:{f.reference.verse}</span>}
                <NoteText text={f.text} translationId={translationId} bookId={bookId} finder={finder} />
              </li>
            ))}
          </ol>
        </aside>
      )}
    </article>
  )
})
