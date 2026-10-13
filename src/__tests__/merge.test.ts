import { describe, expect, it } from 'vitest'
import { findTranslation, type Translation } from '../api'
import type { YvBible } from '../youversion/api'
import { mergeCatalogs } from '../youversion/merge'

const free = (id: string, shortName: string, name: string, language: string): Translation => ({
  id, shortName, name, englishName: name, language, textDirection: 'ltr', website: '', licenseUrl: '', numberOfBooks: 66,
})
const yv = (id: number, abbreviation: string, title: string, language_tag: string): YvBible => ({
  id, abbreviation, localized_abbreviation: abbreviation, title, localized_title: title, language_tag, books: 66,
})

describe('mergeCatalogs', () => {
  const freeList = [
    free('BSB', 'BSB', 'Berean Standard Bible', 'eng'),
    free('eng_ojb', 'TOJB', 'The Orthodox Jewish Bible', 'eng'),
    free('swe_svk', 'SVK', 'Svenska Kärnbibeln - en expanderad översättning', 'swe'),
    free('swe_fol', 'FOL', 'Svenska Folkbibeln', 'swe'),
    free('deu_x', 'BSB', 'Some German Bible', 'deu'),
  ]
  const yvList = [
    yv(3034, 'BSB', 'Berean Standard Bible', 'en'),
    yv(130, 'TOJB2011', 'The Orthodox Jewish Bible', 'en'),
    yv(1111, 'SKB', 'Svenska Kärnbibeln', 'sv'),
    yv(111, 'NIV', 'New International Version', 'en'),
  ]
  const merged = mergeCatalogs(freeList, yvList)
  const byId = new Map(merged.map((t) => [t.id, t]))

  it('pairs by abbreviation, title and known pairs within the same language', () => {
    expect(byId.get('yv-3034')?.freeId).toBe('BSB')
    expect(byId.get('yv-130')?.freeId).toBe('eng_ojb')
    expect(byId.get('yv-1111')?.freeId).toBe('swe_svk')
    // Same abbreviation but a different language is not a match.
    expect(byId.get('deu_x')?.youVersionId).toBeUndefined()
  })

  it('gives shared translations the YouVersion id, name and abbreviation', () => {
    expect(byId.get('yv-1111')).toMatchObject({ shortName: 'SKB', name: 'Svenska Kärnbibeln', source: 'youversion' })
    expect(byId.has('BSB')).toBe(false)
    expect(byId.has('swe_svk')).toBe(false)
  })

  it('lists YouVersion first, then translations only the Free Use Bible API has', () => {
    expect(merged.map((t) => t.id)).toEqual(['yv-3034', 'yv-130', 'yv-1111', 'yv-111', 'swe_fol', 'deu_x'])
    expect(byId.get('yv-111')).toMatchObject({ shortName: 'NIV', source: 'youversion', language: 'en' })
    expect(byId.get('yv-111')?.freeId).toBeUndefined()
    expect(byId.get('swe_fol')).toMatchObject({ shortName: 'FOL' })
  })

  it('finds shared translations by their old Free Use Bible API id', () => {
    expect(findTranslation(merged, 'BSB')?.id).toBe('yv-3034')
    expect(findTranslation(merged, 'yv-3034')?.id).toBe('yv-3034')
    expect(findTranslation(merged, 'swe_fol')?.id).toBe('swe_fol')
    expect(findTranslation(merged, 'nope')).toBeUndefined()
  })

  it('does not pair when a rule matches more than one candidate', () => {
    const twoWebs = [free('a', 'WEB', 'World English Bible', 'eng'), free('b', 'WEB', 'World English Bible', 'eng')]
    const result = mergeCatalogs(twoWebs, [yv(1, 'WEB', 'World English Bible', 'en')])
    expect(result.filter((t) => t.freeId)).toHaveLength(0)
    expect(result.map((t) => t.id)).toEqual(['yv-1', 'a', 'b'])
  })
})
