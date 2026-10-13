import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { fetchChapter, type Book, type Footnote } from '../api'
import { parseChapter } from '../content'
import { useAsync } from '../hooks'
import { referenceLabel, type Reference, type ReferenceFinder } from '../references'
import { hashFor } from '../route'

interface Context {
  translationId: string
  /** The chapter's book, for references like "(see 12:25)". */
  bookId: string
  books: Book[]
  finder: ReferenceFinder
}

const MAX_QUOTES = 3

const linkFor = (ref: Reference, translationId: string) =>
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

/** The referenced verses, read from the current translation. */
function Quote({ reference, translationId, books, onNavigate }: Omit<Context, 'finder' | 'bookId'> & {
  reference: Reference
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

const canHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches

/**
 * A footnote marker. Hovering (or tapping, on touch screens) opens a popover with the
 * note; references in it show the full verse text and link to the verse in the reader.
 */
export function NoteRef({ note, caller, translationId, bookId, books, finder }: Context & { note: Footnote; caller: string }) {
  // "hover" closes when the pointer leaves; "pinned" (after a click or tap) stays until dismissed.
  const [open, setOpen] = useState<'hover' | 'pinned' | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)

  const refs = finder.find(note.text, bookId)
  const close = () => setOpen(null)
  const cancelClose = () => clearTimeout(closeTimer.current)
  const hoverIn = () => {
    cancelClose()
    if (canHover() && !open) setOpen('hover')
  }
  const hoverOut = () => {
    if (open !== 'hover') return
    cancelClose()
    closeTimer.current = setTimeout(close, 250)
  }

  // Place the panel under the marker, or above it when there is no room below.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const a = anchor.current?.getBoundingClientRect()
      const p = panel.current
      if (!a || !p) return
      const width = Math.min(380, window.innerWidth - 24)
      const left = Math.min(Math.max(12, a.left + a.width / 2 - width / 2), window.innerWidth - width - 12)
      const bottomLimit = document.querySelector('.player')?.getBoundingClientRect().top ?? window.innerHeight
      const height = p.offsetHeight
      const below = a.bottom + 8
      const top = below + height > bottomLimit - 8 && a.top - 8 - height > 8 ? a.top - 8 - height : below
      setPosition({ top, left, width })
    }
    place()
    window.addEventListener('scroll', place, { passive: true })
    window.addEventListener('resize', place)
    const observer = new ResizeObserver(place)
    if (panel.current) observer.observe(panel.current)
    return () => {
      window.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
      observer.disconnect()
    }
  }, [open])

  // A pinned popover closes on Escape or a click elsewhere.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!panel.current?.contains(target) && !anchor.current?.contains(target)) close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  useEffect(() => {
    return () => clearTimeout(closeTimer.current)
  }, [])

  return (
    <sup className="note-ref">
      <button
        ref={anchor}
        type="button"
        aria-label={`Footnote ${caller}`}
        aria-expanded={!!open}
        onClick={(e) => {
          e.stopPropagation() // don't also trigger the verse's click-to-play
          setOpen((o) => (o === 'pinned' ? null : 'pinned'))
        }}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        {caller}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            className="note-popover"
            role="dialog"
            aria-label={`Footnote ${caller}`}
            style={position ? { top: position.top, left: position.left, width: position.width } : { visibility: 'hidden' }}
            onMouseEnter={cancelClose}
            onMouseLeave={hoverOut}
            onClick={(e) => e.stopPropagation()}
          >
            {!onlyReferences(note.text, refs) && (
              <p className="note-text">
                <NoteText text={note.text} translationId={translationId} bookId={bookId} finder={finder} onNavigate={close} />
              </p>
            )}
            {refs.slice(0, MAX_QUOTES).map((r, i) => (
              <Quote key={i} reference={r} translationId={translationId} books={books} onNavigate={close} />
            ))}
          </div>,
          document.body,
        )}
    </sup>
  )
}
