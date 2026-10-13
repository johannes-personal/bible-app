import { describe, expect, it } from 'vitest'
import { relatedVerses, toChapterCrossRefs, type CrossRef } from '../crossrefs'

const ref = (book: string, chapter: number, verse: number, score: number, endVerse?: number): CrossRef => ({
  book, chapter, verse, score, ...(endVerse ? { endVerse } : {}),
})

describe('relatedVerses', () => {
  it('shows nothing unless a link is strong enough for a marker', () => {
    expect(relatedVerses(undefined)).toEqual([])
    expect(relatedVerses([ref('PRO', 21, 3, 29), ref('ISA', 1, 11, 20)])).toEqual([])
  })

  it('lists the strongest links down to the minimum score, at most five', () => {
    // Hosea 6:6 in the real data.
    const refs = [61, 48, 41, 33, 30, 29, 27, 9].map((score, i) => ref('MAT', 1, i + 1, score))
    const related = relatedVerses(refs)
    expect(related).toHaveLength(5)
    expect(related[0]).toEqual({ book: 'MAT', chapter: 1, verseStart: 1, verseEnd: 1 })
  })

  it('keeps verse ranges', () => {
    expect(relatedVerses([ref('PSA', 14, 1, 40, 3)])).toEqual([{ book: 'PSA', chapter: 14, verseStart: 1, verseEnd: 3 }])
  })
})

describe('toChapterCrossRefs', () => {
  it('indexes links by verse, strongest first', () => {
    const c = toChapterCrossRefs('HOS', 6, [{ verse: 6, references: [ref('MAT', 12, 7, 48), ref('MAT', 9, 13, 61)] }])
    expect(c.byVerse.get(6)?.map((r) => r.score)).toEqual([61, 48])
  })
})
