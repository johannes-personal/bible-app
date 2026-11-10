import { Fragment, memo, useMemo, useRef, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import type { Book, Footnote } from '../api'
import { verseEntries, type Block, type Part, type VerseBlock, type VerseEntry } from '../content'
import { referenceFinder, type VerseRange } from '../references'
import { alignVerses } from '../versification'
import { splitMarked } from '../wordstudy/highlight'
import { NoteRef, NoteText } from './NotePopover'
import type { Anchor } from './Popover'
import { RelatedRef } from './RelatedRef'

/** A second translation shown beside the first, verse by verse. */
export interface ParallelText {
  /** Its column heading (e.g. a button to change it). */
  label: ReactNode
  /** Empty while loading, or when it doesn't have the chapter (see `message`). */
  blocks: Block[]
  footnotes: Footnote[]
  translationId: string
  books: Book[]
  dir: 'ltr' | 'rtl'
  lang?: string
  /** Shown in its column instead of the text, e.g. while loading. */
  message?: ReactNode
}

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
  /** Opens a verse's original words from its verse number. */
  onVerseWords?: (verse: number, anchor: Anchor) => void
  /** Also open them by pressing and holding a verse. */
  longPress?: boolean
  /** Verses to mark (a word being studied), and its words to mark in them when known. */
  marks?: { verses: Set<number>; phrases: string[] | null }
  /** With a second translation, the chapter is laid out in two columns, verse by verse. */
  parallel?: ParallelText
  /** The first translation's column heading, in the parallel layout. */
  label?: ReactNode
}

const LONG_PRESS_MS = 450

const noteCaller = (i: number) => String.fromCharCode(97 + (i % 26)) // a, b, c…

// Parts are separate strings in the source, so spaces go between them, except around
// punctuation that attaches to a word and where the text already has whitespace.
const CLOSING = /^[\s”’"'»),.;:!?\]]/
const OPENING = /[\s“‘«„([]$/
const spaceAfter = (part: Part & { kind: 'text' }, next: Part | undefined) =>
  !OPENING.test(part.text) && !(next?.kind === 'text' && CLOSING.test(next.text))

interface RendererOptions {
  footnotes: Footnote[]
  translationId: string
  bookId: string
  books: Book[]
  finder: ReturnType<typeof referenceFinder>
  related?: Map<number, VerseRange[]>
  currentIndex?: number
  onVerseClick?: (index: number) => void
  onVerseWords?: Props['onVerseWords']
  marks?: Props['marks']
}

/** Renders one translation's verses, headings and footnote markers. */
function renderer({ footnotes, translationId, bookId, books, finder, related, currentIndex, onVerseClick, onVerseWords, marks }: RendererOptions) {
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

  /**
   * A verse. The first translation's verses carry the verse's number and index (for audio,
   * links and the reading position); a second translation's are plain, and a click on one
   * goes to the first's verse in the same row (`rowIndex`).
   */
  const renderVerse = (v: VerseBlock, rowIndex?: number) => {
    const secondary = rowIndex !== undefined
    const refs = related?.get(v.number)
    const marker = refs && (
      <RelatedRef verse={v.number} related={refs} translationId={translationId} books={books} />
    )
    const lastText = v.parts.findLastIndex((p) => p.kind === 'text')
    const marked = marks?.verses.has(v.number)
    const phrases = marked ? marks?.phrases : null
    const index = secondary ? rowIndex : v.index
    const className = [
      'verse',
      secondary && 'secondary',
      !secondary && v.index === currentIndex && 'current',
      onVerseClick && 'clickable',
      marked && 'studied',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <span
        key={v.index}
        className={className}
        data-index={secondary ? undefined : v.index}
        data-verse={secondary ? undefined : v.number}
        id={secondary ? undefined : `v${v.number}`}
        onClick={onVerseClick && index >= 0 ? () => onVerseClick(index) : undefined}
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

  const renderBefore = (b: VerseEntry['before'][number], key: number) =>
    b.kind === 'heading' ? (
      <h2 key={key} className="section-heading">
        {b.text}
      </h2>
    ) : (
      <p key={key} className="subtitle">
        {b.parts.map((p, i, parts) => renderPart(p, i, parts))}
      </p>
    )

  return { renderPart, renderVerse, renderBefore, callers }
}

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
  longPress: longPressEnabled,
  marks,
  parallel,
  label,
}: Props) {
  const longPress = useLongPress(longPressEnabled ? onVerseWords : undefined)
  const finder = useMemo(() => referenceFinder(books), [books])
  const secondFinder = useMemo(() => referenceFinder(parallel?.books ?? []), [parallel?.books])
  const first = renderer({ footnotes, translationId, bookId, books, finder, related, currentIndex, onVerseClick, onVerseWords, marks })

  const footnoteList = footnotes.length > 0 && (
    <aside className="footnotes">
      <h2>Notes</h2>
      <ol>
        {footnotes.map((f) => (
          <li key={f.noteId} id={`fn-${f.noteId}`}>
            <span className="note-caller">{first.callers.get(f.noteId)}</span>
            {f.reference && <span className="note-ref-label">{f.reference.chapter}:{f.reference.verse}</span>}
            <NoteText text={f.text} translationId={translationId} bookId={bookId} finder={finder} />
          </li>
        ))}
      </ol>
    </aside>
  )

  if (parallel) {
    const second = renderer({
      footnotes: parallel.footnotes,
      translationId: parallel.translationId,
      bookId,
      books: parallel.books,
      finder: secondFinder,
      onVerseClick,
    })
    const rows = verseEntries(blocks)
    const secondEntries = verseEntries(parallel.blocks)
    const aligned = alignVerses(
      bookId,
      rows.map((r) => r.verse.number),
      secondEntries.map((e) => ({ number: e.verse.number, item: e })),
    )
    const cell = (entries: VerseEntry[], render: ReturnType<typeof renderer>, rowIndex?: number) =>
      entries.map((e) => (
        <Fragment key={e.verse.index}>
          {e.before.map(render.renderBefore)}
          <p className={e.poetry ? 'para poetry' : 'para'}>{render.renderVerse(e.verse, rowIndex)}</p>
        </Fragment>
      ))
    return (
      <article className={`reader parallel${longPressEnabled ? ' long-press' : ''}`} {...longPress}>
        <h1 className="chapter-title">{title}</h1>
        <div className="parallel-head">
          <div className="parallel-label">{label}</div>
          <div className="parallel-label secondary">{parallel.label}</div>
        </div>
        {parallel.message && <p className="parallel-message muted">{parallel.message}</p>}
        {rows.map((row, i) => (
          <div key={row.verse.index} className="parallel-row">
            <div className="parallel-cell" dir={dir} lang={lang}>
              {cell([row], first)}
            </div>
            <div className="parallel-cell secondary" dir={parallel.dir} lang={parallel.lang}>
              {cell(aligned[i], second, row.verse.index)}
            </div>
          </div>
        ))}
        {footnoteList}
      </article>
    )
  }

  return (
    <article className={`reader${longPressEnabled ? ' long-press' : ''}`} dir={dir} lang={lang} {...longPress}>
      <h1 className="chapter-title">{title}</h1>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
          case 'subtitle':
            return first.renderBefore(b, i)
          case 'para':
            return (
              <p key={i} className={b.poetry ? 'para poetry' : 'para'}>
                {b.verses.map((v) => first.renderVerse(v))}
              </p>
            )
        }
      })}
      {footnoteList}
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
      // The first translation's verses only (a second's have no number of their own here).
      const verse = target.closest<HTMLElement>('.verse[data-verse]')
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
