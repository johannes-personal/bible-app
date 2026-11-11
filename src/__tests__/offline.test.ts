import { afterEach, describe, expect, it, vi } from 'vitest'
import { savedFreeId, storeSaved } from '../offline/saved'
import { splitTranslation, type CompleteTranslation } from '../offline/split'

const chapter = (number: number) => ({
  numberOfVerses: 2,
  thisChapterAudioLinks: { david: `https://audio.example/${number}.mp3` },
  thisChapterAudioTimings: { david: [0, 4.2] },
  chapter: { number, content: [], footnotes: [] },
})

const complete = {
  translation: { id: 'TST', name: 'Test', shortName: 'TST' },
  books: [
    // Out of order, and a book that starts at chapter 0 (as some psalm collections do).
    { id: 'MAT', name: 'Matthew', commonName: 'Matthew', order: 40, numberOfChapters: 2, chapters: [chapter(1), chapter(2)] },
    { id: 'MAL', name: 'Malachi', commonName: 'Malachi', order: 39, numberOfChapters: 2, chapters: [chapter(0), chapter(1)] },
    { id: 'EMP', name: 'Empty', commonName: 'Empty', order: 41, numberOfChapters: 0, chapters: [] },
  ],
} as unknown as CompleteTranslation

interface ChapterAnswer {
  book: { id: string; firstChapterNumber: number }
  nextChapterReference: unknown
  previousChapterReference: unknown
  thisChapterAudioTimings: Record<string, string>
  numberOfVerses: number
}

describe('splitting a whole translation', () => {
  const files = splitTranslation(complete)
  const body = (path: string) => files.find((f) => f.path === path)!.body as ChapterAnswer

  it('makes the book list and every chapter, under the paths the app asks for', () => {
    expect(files.map((f) => f.path)).toEqual([
      '/api/TST/books.json',
      '/api/TST/MAL/0.json',
      '/api/TST/MAL/1.json',
      '/api/TST/MAT/1.json',
      '/api/TST/MAT/2.json',
    ])
    const books = (files[0].body as { books: { id: string; firstChapterNumber: number; lastChapterNumber: number }[] }).books
    expect(books.map((b) => [b.id, b.firstChapterNumber, b.lastChapterNumber])).toEqual([
      ['MAL', 0, 1],
      ['MAT', 1, 2],
    ])
  })

  it('links each chapter to the one before and after, also across books', () => {
    expect(body('/api/TST/MAL/0.json').previousChapterReference).toBeNull()
    expect(body('/api/TST/MAL/1.json').nextChapterReference).toEqual({ translationId: 'TST', book: 'MAT', chapter: 1 })
    expect(body('/api/TST/MAT/1.json').previousChapterReference).toEqual({ translationId: 'TST', book: 'MAL', chapter: 1 })
    expect(body('/api/TST/MAT/2.json').nextChapterReference).toBeNull()
  })

  it('gives each chapter its book, verse count and links to its narration timings', () => {
    const answer = body('/api/TST/MAT/2.json')
    expect(answer.book).toMatchObject({ id: 'MAT', translationId: 'TST', firstChapterNumber: 1 })
    expect(answer.numberOfVerses).toBe(2)
    expect(answer.thisChapterAudioTimings).toEqual({ david: '/api/TST/MAT/2.david.audioTimings.json' })
  })
})

describe('saved translations', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('find a saved translation by the id it is read under', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    expect(savedFreeId('BSB')).toBeUndefined()
    storeSaved({ translations: { BSB: { name: 'BSB', savedAt: 1, alias: 'yv-3034' }, nld_nbg: { name: 'NBG', savedAt: 2 } } })
    expect(savedFreeId('BSB')).toBe('BSB')
    expect(savedFreeId('yv-3034')).toBe('BSB')
    expect(savedFreeId('nld_nbg')).toBe('nld_nbg')
    expect(savedFreeId('yv-111')).toBeUndefined()
  })
})
