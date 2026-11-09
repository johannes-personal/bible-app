import { describe, expect, it } from 'vitest'
import { bsbVerseOf, verseOffset, versesOfBsb } from '../versification'

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
