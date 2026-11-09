import { fetchInterlinear } from '../api'
import type { StudyReturn } from '../studyReturn'
import { loadEnglish, loadMeta, loadWord, occurrencesOf, type Occurrence } from './data'

// Where a studied word occurs in a chapter, for the reader to mark (loaded when first needed).

export interface ChapterMarks {
  book: string
  chapter: number
  /** BSB verse numbers the word occurs in. */
  verses: number[]
  /** The word's English in the BSB, to mark it in the BSB's text. */
  phrases: string[]
  /** The Hebrew and Greek words studied (one, or those behind an English word). */
  strongs: string[]
  bsbVerseCount: number
}

/** Where a studied word occurs in a chapter. */
export async function chapterMarks(word: StudyReturn['word'], book: string, chapter: number): Promise<ChapterMarks> {
  const [meta, interlinear] = await Promise.all([loadMeta(), fetchInterlinear(book, chapter).catch(() => null)])
  const index = meta.books.findIndex((b) => b.id === book)
  const empty = { book, chapter, verses: [], phrases: [], strongs: [], bsbVerseCount: 0 }
  if (index < 0 || !interlinear) return empty
  const here = (o: Occurrence) => o.book === index && o.chapter === chapter
  let found: Occurrence[] = []
  let phrases: string[] = []
  let strongs: string[] = []
  if (word.kind === 'word') {
    const entry = await loadWord(word.strongs)
    if (!entry) return empty
    found = occurrencesOf(word.strongs, entry).filter(here)
    phrases = found.filter((o) => o.rendering >= 0).map((o) => entry.renderings[o.rendering][0])
    strongs = [word.strongs]
  } else {
    const english = await loadEnglish(word.word)
    if (!english) return empty
    const entries = await Promise.all(english.entry.strongs.map(([s]) => loadWord(s)))
    found = english.entry.strongs.flatMap(([s, , renderings], i) =>
      entries[i] ? occurrencesOf(s, entries[i], renderings).filter(here) : [],
    )
    phrases = Object.keys(english.entry.forms)
    strongs = english.entry.strongs.map(([s]) => s)
  }
  return {
    book,
    chapter,
    verses: [...new Set(found.map((o) => o.verse))].sort((a, b) => a - b),
    phrases: [...new Set(phrases)],
    strongs,
    bsbVerseCount: Math.max(0, ...interlinear.keys()),
  }
}
