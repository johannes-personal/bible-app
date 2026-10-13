import type { VerseRange } from './references'

// Cross references from OpenBible.info (https://www.openbible.info/labs/cross-references/,
// CC BY 4.0), served per chapter by the Free Use Bible API. Each link has a score: the
// number of people who voted it relevant. They use standard verse numbering, so they work
// for every translation.

export interface CrossRef {
  book: string
  chapter: number
  verse: number
  endVerse?: number
  score: number
}

export interface ChapterCrossRefs {
  book: string
  chapter: number
  /** Links per verse number, strongest first. */
  byVerse: Map<number, CrossRef[]>
}

/** A verse gets a marker when it has a link at least this strong (mostly quotations and parallels). */
export const MARKER_SCORE = 30
/** Weaker links shown alongside in the popover, down to this score. */
export const MIN_SCORE = 10
export const MAX_RELATED = 5

/**
 * The links to show for a verse: none unless one reaches MARKER_SCORE; then the strongest
 * links down to MIN_SCORE, at most MAX_RELATED.
 */
export function relatedVerses(refs: CrossRef[] | undefined): VerseRange[] {
  if (!refs?.length || refs[0].score < MARKER_SCORE) return []
  return refs
    .filter((r) => r.score >= MIN_SCORE)
    .slice(0, MAX_RELATED)
    .map((r) => ({ book: r.book, chapter: r.chapter, verseStart: r.verse, verseEnd: r.endVerse ?? r.verse }))
}

/** Normalizes the API's chapter response; links come back sorted strongest first. */
export function toChapterCrossRefs(
  book: string,
  chapter: number,
  content: { verse: number; references: CrossRef[] }[],
): ChapterCrossRefs {
  const byVerse = new Map<number, CrossRef[]>()
  for (const v of content) byVerse.set(v.verse, [...v.references].sort((a, b) => b.score - a.score))
  return { book, chapter, byVerse }
}
