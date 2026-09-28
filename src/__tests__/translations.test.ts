import { describe, expect, it } from 'vitest'
import type { Translation } from '../api'
import { groupTranslations } from '../translations'
import { parseHash, hashFor } from '../route'

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
    expect(groupTranslations(all, ['de']).map((g) => g.language)).toEqual(['deu', 'eng', 'swe', 'afr'])
    expect(groupTranslations(all, ['sv']).map((g) => g.language)).toEqual(['swe', 'eng', 'afr', 'deu'])
  })

  it('filters by name or language', () => {
    expect(groupTranslations(all, [], 'folk').flatMap((g) => g.translations.map((x) => x.id))).toEqual(['swe_fol'])
    expect(groupTranslations(all, [], 'german').map((g) => g.language)).toEqual(['deu'])
  })
})

describe('route hash', () => {
  it('round-trips a chapter reference', () => {
    const ref = { translationId: 'eng_kjv', book: 'JHN', chapter: 3 }
    expect(parseHash(hashFor(ref))).toEqual(ref)
    expect(parseHash('#/nonsense')).toBeNull()
  })
})
