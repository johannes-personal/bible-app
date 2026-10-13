import { describe, expect, it } from 'vitest'
import type { Translation } from '../api'
import { groupTranslations, partitionLanguages } from '../translations'
import { hashFor, initialRoute, parseHash } from '../route'

const t = (id: string, language: string, languageEnglishName: string, name = id): Translation => ({
  id,
  name,
  englishName: name,
  shortName: id,
  language,
  languageEnglishName,
  textDirection: 'ltr',
  website: '',
  licenseUrl: '',
  numberOfBooks: 66,
})

const all = [
  t('deu1', 'deu', 'German'),
  t('BSB', 'eng', 'English', 'Berean Standard Bible'),
  t('swe_fol', 'swe', 'Swedish', 'Svenska Folkbibeln'),
  t('afr1', 'afr', 'Afrikaans'),
]

describe('groupTranslations', () => {
  it('puts preferred languages first, then English and Swedish, then A–Z', () => {
    expect(groupTranslations(all, ['de']).map((g) => g.language)).toEqual(['de', 'en', 'sv', 'af'])
    expect(groupTranslations(all, ['sv']).map((g) => g.language)).toEqual(['sv', 'en', 'af', 'de'])
  })

  it('filters by name or language', () => {
    expect(groupTranslations(all, [], 'folk').flatMap((g) => g.translations.map((x) => x.id))).toEqual(['swe_fol'])
    expect(groupTranslations(all, [], 'german').map((g) => g.language)).toEqual(['de'])
  })
})

describe('partitionLanguages', () => {
  it('suggests preferred languages and the current one, keeping their order', () => {
    const groups = groupTranslations(all, ['de'])
    const { suggested, others } = partitionLanguages(groups, ['de'], 'af')
    expect(suggested.map((g) => g.language)).toEqual(['de', 'en', 'sv', 'af'])
    expect(others).toEqual([])
    expect(partitionLanguages(groups, ['de']).others.map((g) => g.language)).toEqual(['af'])
  })

  it('puts both sources\' codes for a language in one group', () => {
    const merged = [...all, { ...all[2], id: 'yv-1111', language: 'sv' }]
    const swedish = groupTranslations(merged, []).find((g) => g.language === 'sv')
    expect(swedish?.translations.map((t) => t.id).sort()).toEqual(['swe_fol', 'yv-1111'])
    expect(swedish?.label).toBe('Swedish · svenska')
  })
})

describe('initialRoute', () => {
  const last = { translationId: 'BSB', book: 'JHN', chapter: 3, verse: 16 }
  it('resumes the saved chapter and verse when the URL has no chapter', () => {
    expect(initialRoute('', last)).toEqual({ ...last, resume: true })
    expect(initialRoute('', { translationId: 'BSB', book: 'JHN', chapter: 3 })).toEqual({ translationId: 'BSB', book: 'JHN', chapter: 3 })
  })
  it('starts a first visit at John 1 in the NIV', () => {
    expect(initialRoute('', null)).toEqual({ translationId: 'yv-111', book: 'JHN', chapter: 1 })
  })
  it('resumes the saved verse when reloading the same chapter, but not for other chapters or verse links', () => {
    expect(initialRoute('#/BSB/JHN/3', last)).toEqual({ ...last, resume: true })
    expect(initialRoute('#/BSB/JHN/4', last)).toEqual({ translationId: 'BSB', book: 'JHN', chapter: 4 })
    expect(initialRoute('#/BSB/JHN/3/1', last)).toEqual({ translationId: 'BSB', book: 'JHN', chapter: 3, verse: 1 })
  })
})

describe('route hash', () => {
  it('round-trips a chapter reference', () => {
    const ref = { translationId: 'eng_kjv', book: 'JHN', chapter: 3 }
    expect(parseHash(hashFor(ref))).toEqual(ref)
    expect(parseHash('#/nonsense')).toBeNull()
    expect(parseHash('#/BSB/DEU/8/3')).toEqual({ translationId: 'BSB', book: 'DEU', chapter: 8, verse: 3 })
    expect(hashFor({ translationId: 'BSB', book: 'DEU', chapter: 8, verse: 3 })).toBe('#/BSB/DEU/8/3')
  })
})
