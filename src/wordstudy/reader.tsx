import { fetchInterlinear } from '../api'
import { useAsync } from '../hooks'
import { bsbVerseOf, verseOffset } from '../versification'
import { OriginalWordList } from './originals'
import './wordstudy.css'

// The parts of word study the reader uses, loaded when first needed: a verse's original
// words (for the verse popover) and where a studied word occurs in a chapter.

const LANGUAGES: Record<string, string> = { hebrew: 'Hebrew', aramaic: 'Aramaic', greek: 'Greek' }

/** A verse's Hebrew or Greek words, each a link to study it. */
export default function VerseWords({ bookId, bookName, chapter, verse, verseCount, current }: {
  bookId: string
  bookName: string
  chapter: number
  verse: number
  /** Verses in this chapter in the translation being read, to line its numbering up with the BSB's. */
  verseCount: number
  current?: Set<string>
}) {
  const { data, error } = useAsync(`interlinear-${bookId}.${chapter}`, () => fetchInterlinear(bookId, chapter))
  const title = `${bookName} ${chapter}:${verse}`
  if (error) {
    return (
      <>
        <p className="popover-title">{title}</p>
        <p className="muted">There are no Hebrew or Greek words for this book in the word study.</p>
      </>
    )
  }
  if (!data) {
    return (
      <>
        <p className="popover-title">{title}</p>
        <p className="muted">Loading the original words…</p>
      </>
    )
  }
  const bsbCount = Math.max(0, ...data.keys())
  const offset = verseOffset(bookId, verseCount, bsbCount)
  const bsbVerse = bsbVerseOf(verse, offset)
  const words = data.get(bsbVerse) ?? []
  const language = LANGUAGES[words.find((w) => w.strongs)?.language ?? ''] ?? 'Original words'

  return (
    <>
      <p className="popover-title">
        {title} · {language}
      </p>
      {offset > 0 && bsbVerse === 1 ? (
        <p className="muted vw-note">The BSB counts the psalm's title as part of verse 1, so these are the words of both.</p>
      ) : bsbVerse !== verse ? (
        <p className="muted vw-note">Verse {bsbVerse} in the BSB, which counts the psalm's title as part of verse 1.</p>
      ) : (
        offset === 0 &&
        verseCount !== bsbCount && (
          <p className="muted vw-note">This translation numbers this chapter's verses differently from the BSB, so these may be a nearby verse's words.</p>
        )
      )}
      {words.some((w) => w.strongs) ? (
        <OriginalWordList words={words} current={current} />
      ) : (
        <p className="muted">No original words found for this verse.</p>
      )}
      <p className="muted vw-source">Tap a word to study it. From the BSB interlinear.</p>
    </>
  )
}
