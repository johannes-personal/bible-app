import type { Book } from '../api'
import { referenceLabel, type VerseRange } from '../references'
import { Quote } from './NotePopover'
import { Popover } from './Popover'

interface Props {
  verse: number
  related: VerseRange[]
  translationId: string
  books: Book[]
}

/**
 * Marks a verse with strong cross references; hovering or tapping it shows the related
 * verses in the current translation, each linking to the verse in the reader.
 */
export function RelatedRef({ verse, related, translationId, books }: Props) {
  return (
    <Popover
      className="xref"
      label={`Related verses for verse ${verse}: ${related.map((r) => referenceLabel(r, books)).join(', ')}`}
      trigger={
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 9h13l-4-4M19 15H6l4 4" />
        </svg>
      }
    >
      {(close) => (
        <>
          <p className="popover-title">Related verses</p>
          {related.map((r) => (
            <Quote key={`${r.book}${r.chapter}:${r.verseStart}`} reference={r} translationId={translationId} books={books} onNavigate={close} />
          ))}
        </>
      )}
    </Popover>
  )
}
