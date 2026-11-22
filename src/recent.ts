import { load, save } from './storage'

// The passages read lately, for the passage picker: each chapter once, newest first, with the
// verse the reader was at (kept up to date as they scroll), in whatever translation.

export interface RecentPassage {
  book: string
  chapter: number
  verse?: number
}

const RECENT_KEY = 'bible:recentPassages'
const MAX = 8

export const recentPassages = (): RecentPassage[] => load<RecentPassage[]>(RECENT_KEY, [])

export function rememberPassage({ book, chapter, verse }: RecentPassage) {
  const rest = recentPassages().filter((p) => p.book !== book || p.chapter !== chapter)
  save(RECENT_KEY, [verse && verse > 1 ? { book, chapter, verse } : { book, chapter }, ...rest].slice(0, MAX))
}
