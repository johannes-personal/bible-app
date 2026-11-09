// When the reader is opened from a word study page, it remembers that page (for this tab)
// so the reader can mark the word's verses in that chapter and offer a way back.

export interface StudyReturn {
  /** The study page to go back to. */
  hash: string
  /** The word as the study page shows it. */
  label: { original?: string; lang?: string; text: string; gloss?: string }
  word: { kind: 'word'; strongs: string } | { kind: 'english'; word: string }
  /** The chapter that was opened; leaving it ends the visit. */
  book: string
  chapter: number
}

const KEY = 'bible:study-return'

export function saveStudyReturn(r: StudyReturn) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(r))
  } catch {
    // Storage unavailable: the reader just won't show the way back.
  }
}

export function loadStudyReturn(): StudyReturn | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as StudyReturn) : null
  } catch {
    return null
  }
}

export function clearStudyReturn() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
