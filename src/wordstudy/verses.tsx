import { useMemo, useState, type ReactNode } from 'react'
import { fetchFreeChapterOnly, fetchInterlinear } from '../api'
import { Icon } from '../components/Icon'
import { parseChapter } from '../content'
import { useAsync } from '../hooks'
import { byPosition, formatCount, verseHash, verseKey, type Meta, type Occurrence } from './data'
import { bookScope, type Scope } from './scope'
import { TappableVerse } from './bridge'
import { OriginalWordList } from './originals'

// The verses a word occurs in, with the word marked. Each verse opens in place to show the
// verses around it and its Hebrew or Greek words (each a link to its own study page), with
// links to read it in the reader or to see every occurrence in that book.

const PAGE = 20

export function VerseList({ meta, occurrences, highlight, tag, current, onScope, ordered, pageSize = PAGE }: {
  meta: Meta
  /** Already filtered; one entry per word occurrence. */
  occurrences: Occurrence[]
  /** Words or phrases to mark in the verse text. */
  highlight: (o: Occurrence) => string[]
  tag?: (o: Occurrence) => ReactNode
  /** Strong's numbers to mark among a verse's original words. */
  current: Set<string>
  onScope: (scope: Scope) => void
  /** Keep the order given (e.g. best matches first) instead of Bible order. */
  ordered?: boolean
  /** Verses shown before "Show more". */
  pageSize?: number
}) {
  const [shown, setShown] = useState(pageSize)
  // One entry per verse, with every occurrence in it (a word can occur twice in a verse).
  const verses = useMemo(() => {
    const map = new Map<number, Occurrence[]>()
    for (const o of ordered ? occurrences : [...occurrences].sort(byPosition)) {
      const k = verseKey(o)
      map.set(k, [...(map.get(k) ?? []), o])
    }
    return [...map.values()]
  }, [occurrences, ordered])

  if (!verses.length) return <p className="muted">No verses match.</p>
  return (
    <>
      <ol className="ws-occurrences">
        {verses.slice(0, shown).map((os) => (
          <VerseItem
            key={verseKey(os[0])}
            meta={meta}
            o={os[0]}
            marks={os.flatMap(highlight)}
            tag={tag?.(os[0])}
            current={current}
            onScope={onScope}
          />
        ))}
      </ol>
      {verses.length > shown && (
        <button className="button secondary ws-more" onClick={() => setShown((n) => n + PAGE * 2)}>
          Show more ({formatCount(verses.length - shown)} left)
        </button>
      )}
    </>
  )
}

function VerseItem({ meta, o, marks, tag, current, onScope }: {
  meta: Meta
  o: Occurrence
  marks: string[]
  tag?: ReactNode
  current: Set<string>
  onScope: (scope: Scope) => void
}) {
  const [open, setOpen] = useState(false)
  const book = meta.books[o.book]
  const { data: text, error } = useAsync(`bsb-${o.book}.${o.chapter}`, () => bsbChapter(book.id, o.chapter))
  const verse = text?.get(o.verse)
  const around = (from: number, to: number) =>
    [...(text?.entries() ?? [])].filter(([n]) => n >= from && n <= to).map(([n, t]) => (
      <span key={n}>
        <sup>{n}</sup>
        {t}{' '}
      </span>
    ))

  return (
    <li className={open ? 'open' : undefined}>
      <div className="ws-occ-head">
        <button className="ws-ref" aria-expanded={open} onClick={() => setOpen(!open)}>
          {book.name} {o.chapter}:{o.verse}
          <Icon name="chevronDown" />
        </button>
        {tag}
      </div>
      {open && <p className="ws-context">{around(o.verse - 2, o.verse - 1)}</p>}
      <p className={`ws-verse${verse == null ? ' muted' : ''}`}>
        {error ? (
          "Couldn't load the verse."
        ) : verse == null ? (
          '…'
        ) : (
          <TappableVerse text={verse} marks={marks} bookId={book.id} chapter={o.chapter} verse={o.verse} />
        )}
      </p>
      {open && (
        <>
          <p className="ws-context">{around(o.verse + 1, o.verse + 2)}</p>
          <OriginalWords bookId={book.id} chapter={o.chapter} verse={o.verse} current={current} />
          <div className="ws-occ-actions">
            <a className="link" href={verseHash(meta, o)}>
              Read {book.name} {o.chapter} <Icon name="chevronRight" />
            </a>
            <button className="link" onClick={() => onScope(bookScope(meta, o.book))}>
              All in {book.name}
            </button>
          </div>
        </>
      )}
    </li>
  )
}

/**
 * The verse's Hebrew or Greek words in English order: the English links to its English study
 * page, the original to its own.
 */
function OriginalWords({ bookId, chapter, verse, current }: {
  bookId: string
  chapter: number
  verse: number
  current: Set<string>
}) {
  const { data, error } = useAsync(`interlinear-${bookId}.${chapter}`, () => fetchInterlinear(bookId, chapter))
  if (error) return null
  if (!data) return <p className="muted ws-words-loading">Loading the original words…</p>
  return <OriginalWordList words={data.get(verse) ?? []} current={current} />
}

const chapterText = new Map<string, Promise<Map<number, string>>>()

/** BSB verse texts of a chapter, by verse number. */
function bsbChapter(bookId: string, chapter: number) {
  const key = `${bookId}.${chapter}`
  let p = chapterText.get(key)
  if (!p) {
    p = fetchFreeChapterOnly('BSB', bookId, chapter).then(
      (d) => new Map(parseChapter(d.chapter.content).verses.map((v) => [v.number, v.text])),
    )
    p.catch(() => chapterText.delete(key))
    chapterText.set(key, p)
  }
  return p
}
