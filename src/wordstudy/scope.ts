import type { Meta } from './data'

// Which part of the Bible the word study dashboards are looking at.

export type Mode = 'count' | 'rate'

/** The part of the Bible being looked at; empty means all of it. */
export interface Scope {
  section?: number
  book?: number
  chapter?: number
}

export const TESTAMENTS = [
  { name: 'Old Testament', sections: [0, 1, 2, 3, 4] },
  { name: 'New Testament', sections: [5, 6, 7, 8, 9] },
]

export function inScope(meta: Meta, scope: Scope, o: { book: number; chapter: number }): boolean {
  if (scope.book != null) return o.book === scope.book && (scope.chapter == null || o.chapter === scope.chapter)
  if (scope.section != null) return meta.books[o.book].section === scope.section
  return true
}

/** "Hosea 6", "Hosea", "the Minor prophets" or "the whole Bible". */
export function scopeLabel(meta: Meta, scope: Scope): string {
  if (scope.book != null) return `${meta.books[scope.book].name}${scope.chapter != null ? ` ${scope.chapter}` : ''}`
  if (scope.section != null) return meta.sections[scope.section]
  return 'the whole Bible'
}

/** The scope for one book, with its section, so the breadcrumb can show both. */
export const bookScope = (meta: Meta, book: number): Scope => ({ section: meta.books[book].section, book })
