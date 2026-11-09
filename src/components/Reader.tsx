import { Fragment, memo, useMemo, useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import type { Book, Footnote } from '../api'
import type { Block, Part, VerseBlock } from '../content'
import { referenceFinder, type VerseRange } from '../references'
import { splitMarked } from '../wordstudy/highlight'
import { NoteRef, NoteText } from './NotePopover'
import type { Anchor } from './Popover'
import { RelatedRef } from './RelatedRef'

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
  /** Strong cross references per verse number; verses listed here get a marker. */
  related: Map<number, VerseRange[]>
  /** Opens a verse's original words: from its verse number, or a long press on the verse. */
  onVerseWords?: (verse: number, anchor: Anchor) => void
  /** Verses to mark (a word being studied), and its words to mark in them when known. */
  marks?: { verses: Set<number>; phrases: string[] | null }
}

const LONG_PRESS_MS = 450

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
  related,
  onVerseWords,
  marks,
}: Props) {
  const longPress = useLongPress(onVerseWords)
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

  /** `trailing` goes inside the part, so in poetry it stays on the verse's last line. */
  const renderPart = (p: Part, i: number, parts: Part[], trailing?: ReactNode, phrases?: string[] | null): ReactNode => {
    switch (p.kind) {
      case 'text': {
        const cls = [p.poem ? `line poem-${Math.min(p.poem, 3)}` : '', p.jesus ? 'jesus' : '']
          .filter(Boolean)
          .join(' ')
        return (
          <span key={i} className={cls || undefined}>
            {phrases
              ? splitMarked(p.text, phrases).map((s, j) => (
                  <Fragment key={j}>{s.marked ? <mark className="study-word">{s.text}</mark> : s.text}</Fragment>
                ))
              : p.text}
            {p.notes?.map(noteRef)}
            {trailing}
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

  const renderVerse = (v: VerseBlock) => {
    const refs = related.get(v.number)
    const marker = refs && (
      <RelatedRef verse={v.number} related={refs} translationId={translationId} books={books} />
    )
    const lastText = v.parts.findLastIndex((p) => p.kind === 'text')
    const marked = marks?.verses.has(v.number)
    const phrases = marked ? marks?.phrases : null
    return (
      <span
        key={v.index}
        className={`verse${v.index === currentIndex ? ' current' : ''}${onVerseClick ? ' clickable' : ''}${marked ? ' studied' : ''}`}
        data-index={v.index}
        data-verse={v.number}
        id={`v${v.number}`}
        onClick={onVerseClick ? () => onVerseClick(v.index) : undefined}
      >
        <sup className="vnum">
          {onVerseWords ? (
            <button
              type="button"
              className="vnum-button"
              aria-label={`Verse ${v.number}: original words`}
              onClick={(e) => {
                e.stopPropagation() // don't also trigger the verse's click-to-play
                onVerseWords(v.number, e.currentTarget)
              }}
            >
              {v.number}
            </button>
          ) : (
            v.number
          )}
        </sup>
        {v.parts.map((p, i, parts) => renderPart(p, i, parts, i === lastText ? marker : undefined, phrases))}
        {lastText < 0 && marker}
      </span>
    )
  }

  return (
    <article className="reader" dir={dir} lang={lang} {...longPress}>
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

/**
 * Pressing and holding a verse (without moving) opens its original words. The click that
 * ends the press is swallowed, so it doesn't also jump the audio to the verse.
 */
function useLongPress(onVerseWords: Props['onVerseWords']) {
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null)
  const fired = useRef(false)
  if (!onVerseWords) return {}
  const cancel = () => {
    if (press.current) clearTimeout(press.current.timer)
    press.current = null
  }
  return {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false
      cancel()
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const target = e.target as Element
      if (target.closest('button, a, input')) return
      const verse = target.closest<HTMLElement>('.verse')
      if (!verse) return
      const { pageX, pageY } = e
      press.current = {
        x: e.clientX,
        y: e.clientY,
        timer: setTimeout(() => {
          press.current = null
          fired.current = true
          window.getSelection()?.removeAllRanges()
          navigator.vibrate?.(10)
          onVerseWords(Number(verse.dataset.verse), { pageX, pageY })
        }, LONG_PRESS_MS),
      }
    },
    onPointerMove: (e: PointerEvent) => {
      const p = press.current
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancel()
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture: (e: MouseEvent) => {
      if (!fired.current) return
      fired.current = false
      e.stopPropagation()
      e.preventDefault()
    },
    onContextMenu: (e: MouseEvent) => {
      if (fired.current || press.current) e.preventDefault()
    },
  }
}
