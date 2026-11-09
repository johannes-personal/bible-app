import { describe, expect, it } from 'vitest'
// @ts-expect-error: a plain Node script without type declarations
import { lemmatizer, renderingOf, tokensOf } from '../../scripts/build-word-study.mjs'
import { normalizeStrongs, parseStudyHash, studyHash } from '../route'
import { decodeVerse, fold, occurrencesOf, suggestOriginal, type NameEntry } from '../wordstudy/data'
import { highlightText } from '../wordstudy/highlight'

describe('word study index (build script)', () => {
  it('keeps the meaning-bearing core of a rendering', () => {
    expect(renderingOf('of the LORD')).toBe('LORD')
    expect(renderingOf('according to Your loving devotion')).toBe('loving devotion')
    expect(renderingOf('you love')).toBe('love')
    expect(renderingOf('loved them')).toBe('loved')
    expect(renderingOf('the')).toBe('the') // nothing else to keep
    expect(renderingOf('. . .')).toBeNull()
    expect(renderingOf(null)).toBeNull()
  })

  it('indexes meaningful English words only', () => {
    expect(tokensOf('loving devotion')).toEqual(['loving', 'devotion'])
    expect(tokensOf("God's people")).toEqual(['god', 'people'])
    expect(tokensOf('to them')).toEqual([])
  })

  it('groups word forms under a base form that occurs in the text', () => {
    const lemma = lemmatizer(new Set(['love', 'mercy', 'sin', 'lovely', 'bless']))
    expect(['loved', 'loves', 'loving', 'love'].map(lemma)).toEqual(['love', 'love', 'love', 'love'])
    expect(lemma('mercies')).toBe('mercy')
    expect(lemma('sinned')).toBe('sin')
    expect(lemma('lovely')).toBe('lovely')
    expect(lemma('blessed')).toBe('bless')
    expect(lemma('kindness')).toBe('kindness')
  })
})

describe('word study routes', () => {
  it('normalizes Strong’s numbers', () => {
    expect(normalizeStrongs('g26')).toBe('G0026')
    expect(normalizeStrongs('H2617')).toBe('H2617')
    expect(normalizeStrongs('love')).toBeNull()
  })

  it('parses and builds study hashes', () => {
    expect(parseStudyHash('#/study')).toEqual({ kind: 'home' })
    expect(parseStudyHash('#/study/g26')).toEqual({ kind: 'word', strongs: 'G0026' })
    expect(parseStudyHash('#/study/en/Mercy')).toEqual({ kind: 'english', word: 'mercy' })
    expect(parseStudyHash('#/BSB/JHN/3')).toBeNull()
    expect(studyHash({ kind: 'english', word: 'steadfast love' })).toBe('#/study/en/steadfast%20love')
    expect(parseStudyHash(studyHash({ kind: 'english', word: 'steadfast love' }))).toEqual({ kind: 'english', word: 'steadfast love' })
  })
})

describe('word study data', () => {
  it('decodes verse codes', () => {
    expect(decodeVerse(42_003_016)).toEqual({ book: 42, chapter: 3, verse: 16 })
  })

  it('lists occurrences, optionally of some renderings only', () => {
    const entry = { definition: '', renderings: [['love', 2], ['beloved', 1]] as [string, number][], occurrences: [42_003_016, 0, 42_013_034, 1, 61_004_008, 0], related: [] }
    expect(occurrencesOf('G0026', entry).map((o) => o.verse)).toEqual([16, 34, 8])
    expect(occurrencesOf('G0026', entry, [1])).toEqual([{ book: 42, chapter: 13, verse: 34, rendering: 1, strongs: 'G0026' }])
  })

  it('finds Hebrew and Greek words by transliteration without accents', () => {
    const names: Record<string, NameEntry> = {
      G0026: ['ἀγάπη', 'agapē', 'love', 116, 'g'],
      G0027: ['ἀγαπητός', 'agapētos', 'beloved', 61, 'g'],
      H2617: ['חֶ֫סֶד', 'chesed', 'kindness', 247, 'h'],
    }
    expect(fold('agapē')).toBe('agape')
    expect(suggestOriginal(names, 'agape')).toEqual(['G0026', 'G0027'])
    expect(suggestOriginal(names, 'kind')).toEqual(['H2617'])
    expect(suggestOriginal(names, 'x')).toEqual([])
  })

  it('highlights whole words and phrases, ignoring case', () => {
    const parts = highlightText('With loving devotion You will lead the people You love.', ['love', 'loving devotion'])
    const marked = parts.filter((p) => typeof p === 'object').map((p) => (p as { props: { children: string } }).props.children)
    expect(marked).toEqual(['loving devotion', 'love'])
    expect(highlightText('Beloved, let us love', ['love']).length).toBe(3) // not inside "Beloved"
  })
})
