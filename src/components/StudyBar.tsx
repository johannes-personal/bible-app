import type { StudyReturn } from '../studyReturn'
import { Icon } from './Icon'

/**
 * Shown in a chapter opened from word study: the word (a link back to its study page), how
 * many verses here use it (each press goes to the next one), and a button to dismiss it.
 */
export function StudyBar({ study, count, onNext, onClose }: {
  study: StudyReturn
  /** Verses in this chapter with the word; null while loading. */
  count: number | null
  onNext: () => void
  onClose: () => void
}) {
  const { label } = study
  return (
    <div className="study-bar" role="region" aria-label="Word study">
      <a className="study-bar-back" href={study.hash} title="Back to the word study">
        <Icon name="back" />
        <span className="study-bar-word">
          {label.original && (
            <>
              <span className="study-bar-original" lang={label.lang}>{label.original}</span>{' '}
            </>
          )}
          <strong>{label.text}</strong>
          {label.gloss && <span className="muted"> · {label.gloss}</span>}
        </span>
      </a>
      {count != null && count > 0 && (
        <button className="study-bar-count" onClick={onNext} title="Go to the next verse with the word">
          {count} {count === 1 ? 'verse' : 'verses'}
          <Icon name="chevronDown" />
        </button>
      )}
      <button className="icon-button study-bar-close" aria-label="Stop marking the word" onClick={onClose}>
        <Icon name="close" />
      </button>
    </div>
  )
}
