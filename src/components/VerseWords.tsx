import { lazy, Suspense } from 'react'
import { AnchoredPanel, type Anchor } from './Popover'

// Loaded with the word study code, the first time a verse's words are opened.
const Content = lazy(() => import('../wordstudy/reader'))

/** A popover with a verse's Hebrew or Greek words, each a link to study it. */
export function VerseWordsPopover({ verse, anchor, bookId, bookName, chapter, verseCount, current, onClose }: {
  verse: number
  anchor: Anchor
  bookId: string
  bookName: string
  chapter: number
  verseCount: number
  current?: Set<string>
  onClose: () => void
}) {
  return (
    <AnchoredPanel label={`Original words of verse ${verse}`} anchor={anchor} onClose={onClose} className="verse-words">
      {/* Following a link leaves the reader; close first so nothing lingers. */}
      <div onClick={(e) => (e.target as Element).closest('a') && onClose()}>
        <Suspense fallback={<p className="muted">Loading the original words…</p>}>
          <Content bookId={bookId} bookName={bookName} chapter={chapter} verse={verse} verseCount={verseCount} current={current} />
        </Suspense>
      </div>
    </AnchoredPanel>
  )
}
