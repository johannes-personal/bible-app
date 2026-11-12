import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The first chapter must not wait for the list of translations: YouVersion's part of it takes
// seconds when it isn't cached. These tests answer the network by hand to check that.

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
const never = () => new Promise<Response>(() => {})

const chapter = (numberOfVerses: number) => ({
  translation: { id: 'BSB', name: 'Berean Standard Bible', shortName: 'BSB', language: 'eng' },
  book: { id: 'JHN', name: 'John', commonName: 'John', order: 43, numberOfChapters: 21 },
  chapter: { number: 3, content: [], footnotes: [] },
  numberOfVerses,
  nextChapterReference: null,
  previousChapterReference: null,
  thisChapterAudioLinks: { david: 'https://audio.example/david.mp3' },
  thisChapterAudioTimings: { david: '/api/BSB/JHN/3.david.audioTimings.json' },
})

const freeList = {
  translations: [
    { id: 'BSB', shortName: 'BSB', name: 'Berean Standard Bible', englishName: 'Berean Standard Bible', language: 'eng', textDirection: 'ltr', website: '', licenseUrl: '', numberOfBooks: 66 },
  ],
}
const yvList = [
  { id: 3034, abbreviation: 'BSB', localized_abbreviation: 'BSB', title: 'Berean Standard Bible', localized_title: 'Berean Standard Bible', language_tag: 'en', books: 66 },
  { id: 111, abbreviation: 'NIV', localized_abbreviation: 'NIV', title: 'New International Version', localized_title: 'New International Version', language_tag: 'en', books: 66 },
]

/** Answers requests by the first matching part of their URL. */
function network(routes: [string, () => Response | Promise<Response>][]) {
  vi.stubGlobal('fetch', (input: string | URL) => {
    const url = String(input)
    const route = routes.find(([part]) => url.includes(part))
    return Promise.resolve(route ? route[1]() : new Response('', { status: 404 }))
  })
}

const soon = <T,>(promise: Promise<T>) =>
  Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('still waiting')), 300))])

describe('loading a chapter', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  it("doesn't wait for the list of translations", async () => {
    network([
      ['available_translations.json', never],
      ['catalog=1', never],
      ['/api/BSB/JHN/3.json', () => json(chapter(36))],
    ])
    const { fetchChapter } = await import('../api')
    const data = await soon(fetchChapter({ translationId: 'BSB', book: 'JHN', chapter: 3 }))
    expect(data.numberOfVerses).toBe(36)
    expect(Object.keys(data.thisChapterAudioLinks)).toEqual(['david'])
  })

  it('finds the free narration of a translation read from YouVersion, once the list is in', async () => {
    network([
      ['available_translations.json', () => json(freeList)],
      ['/api/yv?catalog=1', () => json(yvList)],
      ['/api/BSB/JHN/3.json', () => json(chapter(36))],
    ])
    const { fetchNarration, withNarration } = await import('../api')
    const ref = { translationId: 'yv-3034', book: 'JHN', chapter: 3 }
    const narration = await soon(fetchNarration(ref, 36))
    expect(narration).toEqual({
      links: { david: 'https://audio.example/david.mp3' },
      timings: { david: '/api/BSB/JHN/3.david.audioTimings.json' },
    })
    // Added to what the chapter came with.
    const text = { ...chapter(36), thisChapterAudioLinks: {}, thisChapterAudioTimings: {} }
    expect(Object.keys(withNarration(text as never, narration).thisChapterAudioLinks)).toEqual(['david'])
    expect(withNarration(text as never, null)).toBe(text)
  })

  it('leaves narration out when its verses do not line up, or the translation has none', async () => {
    network([
      ['available_translations.json', () => json(freeList)],
      ['/api/yv?catalog=1', () => json(yvList)],
      ['/api/BSB/JHN/3.json', () => json(chapter(36))],
    ])
    const { fetchNarration } = await import('../api')
    expect(await soon(fetchNarration({ translationId: 'yv-3034', book: 'JHN', chapter: 3 }, 35))).toBeNull()
    expect(await soon(fetchNarration({ translationId: 'yv-111', book: 'JHN', chapter: 3 }, 36))).toBeNull()
    // A free translation's own narration comes with its text; nothing to add.
    expect(await soon(fetchNarration({ translationId: 'BSB', book: 'JHN', chapter: 3 }, 36))).toBeNull()
  })
})
