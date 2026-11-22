import { afterEach, describe, expect, it, vi } from 'vitest'
import { recentPassages, rememberPassage } from '../recent'

describe('recent passages', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps each chapter once, newest first, at the verse last read', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    rememberPassage({ book: 'PSA', chapter: 8 })
    rememberPassage({ book: 'JHN', chapter: 3, verse: 16 })
    rememberPassage({ book: 'PSA', chapter: 8, verse: 4 })
    rememberPassage({ book: 'ROM', chapter: 8, verse: 1 })
    expect(recentPassages()).toEqual([
      { book: 'ROM', chapter: 8 },
      { book: 'PSA', chapter: 8, verse: 4 },
      { book: 'JHN', chapter: 3, verse: 16 },
    ])
    for (let c = 1; c <= 12; c++) rememberPassage({ book: 'GEN', chapter: c })
    expect(recentPassages()).toHaveLength(8)
    expect(recentPassages()[0]).toEqual({ book: 'GEN', chapter: 12 })
  })
})
