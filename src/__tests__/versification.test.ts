import { describe, expect, it } from 'vitest'
import { alignVerses, bsbVerseOf, verseOffset, versesOfBsb } from '../versification'

describe('verse numbering against the BSB', () => {
  it('finds psalms whose titles are numbered as verses', () => {
    expect(verseOffset('PSA', 21, 19)).toBe(2) // Psalm 51 in the NBG 1951
    expect(verseOffset('PSA', 13, 12)).toBe(1)
    expect(verseOffset('PSA', 19, 19)).toBe(0)
  })

  it('leaves other books and larger differences alone', () => {
    expect(verseOffset('MAL', 6, 18)).toBe(0)
    expect(verseOffset('JHN', 37, 36)).toBe(0)
    expect(verseOffset('PSA', 25, 19)).toBe(0)
  })

  it('maps verses both ways', () => {
    expect(bsbVerseOf(3, 2)).toBe(1)
    expect(bsbVerseOf(1, 2)).toBe(1)
    expect(bsbVerseOf(21, 2)).toBe(19)
    expect(versesOfBsb(1, 2)).toEqual([1, 2, 3])
    expect(versesOfBsb(19, 2)).toEqual([21])
    expect(versesOfBsb(5, 0)).toEqual([5])
  })
})

describe('lining up two translations', () => {
  const nums = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)
  const items = (ns: number[]) => ns.map((n) => ({ number: n, item: n }))

  it('matches verses by number', () => {
    expect(alignVerses('JHN', [1, 2, 3], items([1, 2, 3]))).toEqual([[1], [2], [3]])
  })

  it('puts a psalm title numbered as verses with verse 1', () => {
    // BSB Psalm 51 (19 verses) beside the NBG 1951 (21)
    const rows = alignVerses('PSA', nums(1, 19), items(nums(1, 21)))
    expect(rows[0]).toEqual([1, 2, 3])
    expect(rows[1]).toEqual([4])
    expect(rows[18]).toEqual([21])
  })

  it('works the other way round', () => {
    const rows = alignVerses('PSA', nums(1, 21), items(nums(1, 19)))
    expect(rows[0]).toEqual([1])
    expect(rows[1]).toEqual([])
    expect(rows[2]).toEqual([])
    expect(rows[3]).toEqual([2])
    expect(rows[20]).toEqual([19])
  })

  it('keeps verses the first translation lacks next to the one before', () => {
    // 3 John: 14 verses in one, 15 in the other
    expect(alignVerses('3JN', [13, 14], items([13, 14, 15]))).toEqual([[13], [14, 15]])
    // a combined verse "1-2" given as verse 1, then verse 3
    expect(alignVerses('ROM', [1, 2, 3], items([1, 3]))).toEqual([[1], [], [3]])
  })
})
