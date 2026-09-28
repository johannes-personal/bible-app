import { describe, expect, it } from 'vitest'
import { buildSegments, splitText, verseAt } from '../audio/engines'

describe('verseAt', () => {
  const starts = [4, 9.7, 22.8, 31.6]
  it('finds the verse playing at a time', () => {
    expect(verseAt(starts, 0)).toBe(-1)
    expect(verseAt(starts, 4)).toBe(0)
    expect(verseAt(starts, 22)).toBe(1)
    expect(verseAt(starts, 500)).toBe(3)
  })
  it('handles missing timings', () => {
    expect(verseAt([], 10)).toBe(-1)
  })
})

describe('splitText', () => {
  it('leaves short text alone', () => {
    expect(splitText('In the beginning.')).toEqual(['In the beginning.'])
    expect(splitText('')).toEqual([])
  })

  it('splits long text at sentence boundaries within the limit', () => {
    const text = 'First sentence here. Second one follows! Third is a question? Fourth ends it.'
    const parts = splitText(text, 45)
    expect(parts.every((p) => p.length <= 45)).toBe(true)
    expect(parts.join(' ')).toBe(text)
  })

  it('falls back to commas and spaces', () => {
    const text = 'word '.repeat(60).trim()
    const parts = splitText(text, 50)
    expect(parts.every((p) => p.length <= 50)).toBe(true)
    expect(parts.join(' ')).toBe(text)
  })
})

describe('buildSegments', () => {
  it('tracks verse index and running offsets', () => {
    const { segments, total } = buildSegments(['abc', 'de'])
    expect(segments).toEqual([
      { verseIndex: 0, text: 'abc', start: 0 },
      { verseIndex: 1, text: 'de', start: 4 },
    ])
    expect(total).toBe(7)
  })
})
