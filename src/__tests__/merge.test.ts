import { describe, expect, it } from 'vitest'
import type { Translation } from '../api'
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
    expect(byId.get('BSB')?.youVersionId).toBe(3034)
    expect(byId.get('eng_ojb')?.youVersionId).toBe(130)
    expect(byId.get('swe_svk')?.youVersionId).toBe(1111)
    // Same abbreviation but a different language is not a match.
    expect(byId.get('deu_x')?.youVersionId).toBeUndefined()
  })

  it("shows YouVersion's name and abbreviation for shared translations", () => {
    expect(byId.get('swe_svk')).toMatchObject({ shortName: 'SKB', name: 'Svenska Kärnbibeln', language: 'swe' })
    expect(byId.get('swe_fol')?.shortName).toBe('FOL')
  })

  it('adds YouVersion-only Bibles with their own ids and keeps everything else', () => {
    expect(byId.get('yv-111')).toMatchObject({ shortName: 'NIV', source: 'youversion', language: 'en' })
    expect(merged).toHaveLength(freeList.length + 1)
  })

  it('does not pair when a rule matches more than one candidate', () => {
    const twoWebs = [free('a', 'WEB', 'World English Bible', 'eng'), free('b', 'WEB', 'World English Bible', 'eng')]
    const result = mergeCatalogs(twoWebs, [yv(1, 'WEB', 'World English Bible', 'en')])
    expect(result.filter((t) => !t.source && t.youVersionId)).toHaveLength(0)
    expect(result.map((t) => t.id)).toContain('yv-1')
  })
})
