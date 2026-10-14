import { describe, expect, it } from 'vitest'
import type { Translation } from '../api'
import {
  bbTranslation,
  bibleBrainAudio,
  coversBook,
  filesetsFor,
  shortNameOf,
  toVerseStarts,
  versesToContent,
  type BbBible,
} from '../biblebrain/api'
import { addBibleBrain } from '../biblebrain/merge'

// Synthetic catalogue entries shaped like the /api/bb?catalog=1 response.
const HSV: BbBible = {
  id: 'NLDHSV',
  name: 'Herziene Statenvertaling (HSV)',
  language: 'Dutch',
  autonym: 'Nederlands',
  iso: 'nld',
  filesets: [
    { id: 'NLDHSVN_ET', type: 'text_plain', size: 'NT' },
    { id: 'NLDHSVO_ET', type: 'text_plain', size: 'OT' },
    { id: 'NLDHSVN1DA', type: 'audio', size: 'NT', timed: true },
    { id: 'NLDHSVO1DA', type: 'audio', size: 'OT' },
    { id: 'NLDHSVN2DA', type: 'audio_drama', size: 'NTP' },
  ],
}
const NBV: BbBible = {
  id: 'NLDNBV',
  name: 'New Dutch Translation (de Nieuwe Bijbelvertaling)',
  language: 'Dutch',
  iso: 'nld',
  filesets: [{ id: 'NLDNBVN1DA', type: 'audio', size: 'NT' }],
}
const SFB98: BbBible = {
  id: 'SWESFB',
  name: 'Svenska Folkbibeln 98',
  language: 'Swedish',
  iso: 'swe',
  filesets: [
    { id: 'SWESFBN_ET', type: 'text_plain', size: 'NT' },
    { id: 'SWESFBN1DA', type: 'audio', size: 'NT', timed: true },
  ],
}
const KJV: BbBible = {
  id: 'ENGKJV',
  name: 'King James Version',
  language: 'English',
  iso: 'eng',
  filesets: [
    { id: 'ENGKJVC_ET', type: 'text_plain', size: 'C' },
    { id: 'ENGKJVN2DA', type: 'audio_drama', size: 'NT', timed: true },
  ],
}
const TEXT_ONLY: BbBible = {
  id: 'NLDDSV',
  name: '1750 Dutch Staten Vertaling Bible',
  language: 'Dutch',
  iso: 'nld',
  filesets: [{ id: 'NLDDSVN_ET', type: 'text_plain', size: 'NT' }],
}

const translation = (id: string, shortName: string, name: string, language: string, extra: Partial<Translation> = {}): Translation => ({
  id, shortName, name, englishName: name, language, textDirection: 'ltr', website: '', licenseUrl: '', numberOfBooks: 66, ...extra,
})

describe('Bible Brain filesets', () => {
  it('knows which testament a size code covers', () => {
    expect(coversBook('C', 'GEN')).toBe(true)
    expect(coversBook('NT', 'JHN')).toBe(true)
    expect(coversBook('NT', 'PSA')).toBe(false)
    expect(coversBook('NTPOTP', 'PSA')).toBe(true)
    expect(coversBook('OT', 'REV')).toBe(false)
  })

  it('picks complete and timed recordings first', () => {
    expect(filesetsFor(HSV, 'JHN', ['audio', 'audio_drama']).map((f) => f.id)).toEqual(['NLDHSVN1DA', 'NLDHSVN2DA'])
    expect(filesetsFor(HSV, 'GEN', ['text_plain']).map((f) => f.id)).toEqual(['NLDHSVO_ET'])
  })

  it('lists narration per chapter through the proxy, with Bible Brain timings', () => {
    expect(bibleBrainAudio(HSV, 'JHN', 3)).toEqual({
      links: {
        'Faith Comes By Hearing': '/api/bb?audio=NLDHSVN1DA/JHN/3',
        'Faith Comes By Hearing (dramatized)': '/api/bb?audio=NLDHSVN2DA/JHN/3',
      },
      timings: {
        'Faith Comes By Hearing': 'bb:NLDHSVN1DA/JHN/3',
        'Faith Comes By Hearing (dramatized)': 'bb:NLDHSVN2DA/JHN/3',
      },
    })
    expect(bibleBrainAudio(NBV, 'GEN', 1)).toEqual({ links: {}, timings: {} })
  })
})

describe('Bible Brain content', () => {
  it('turns plain-text verses into chapter content', () => {
    const content = versesToContent([
      { book_id: 'JHN', chapter: 3, verse_start: 2, verse_text: 'Second. ' },
      { book_id: 'JHN', chapter: 3, verse_start: 1, verse_text: 'First.' },
      { book_id: 'JHN', chapter: 3, verse_start: 3, verse_text: '  ' },
    ])
    expect(content).toEqual([
      { type: 'verse', number: 1, content: ['First.'] },
      { type: 'verse', number: 2, content: ['Second.'] },
    ])
  })

  it('turns timestamps into verse start times, without the spoken heading', () => {
    expect(
      toVerseStarts([
        { verse_start: '0', timestamp: 0 },
        { verse_start: '2', timestamp: 7.5 },
        { verse_start: '1', timestamp: 2.25 },
        { verse_start: '3', timestamp: 12 },
      ]),
    ).toEqual([2.25, 7.5, 12])
  })

  it('presents a Bible as a translation', () => {
    expect(shortNameOf(HSV)).toBe('HSV')
    expect(shortNameOf(SFB98)).toBe('SFB98')
    expect(shortNameOf(KJV)).toBe('KJV')
    expect(bbTranslation(HSV, '© HSV')).toMatchObject({
      id: 'bb-NLDHSV',
      name: 'Herziene Statenvertaling',
      shortName: 'HSV',
      language: 'nld',
      languageName: 'Nederlands',
      source: 'biblebrain',
      bibleBrainId: 'NLDHSV',
      copyright: '© HSV',
      website: 'https://live.bible.is/bible/NLDHSV',
    })
  })
})

describe('addBibleBrain', () => {
  const catalog = [
    translation('yv-1', 'KJV', 'King James Version', 'en', { source: 'youversion', freeId: 'eng_kjv' }),
    translation('swe_fol', 'FOL', 'Svenska Folkbibeln', 'swe'),
    translation('nld_nbg', 'NBG', 'NBG-vertaling 1951', 'nld'),
  ]
  const merged = addBibleBrain(catalog, [HSV, NBV, SFB98, KJV, TEXT_ONLY])
  const byId = new Map(merged.map((t) => [t.id, t]))

  it('attaches narration to translations the app already has', () => {
    expect(byId.get('yv-1')?.bibleBrainId).toBe('ENGKJV')
    expect(byId.get('swe_fol')?.bibleBrainId).toBe('SWESFB')
    expect(byId.get('nld_nbg')?.bibleBrainId).toBeUndefined()
  })

  it('adds unmatched Bibles that have both text and narration', () => {
    expect(byId.get('bb-NLDHSV')).toMatchObject({ shortName: 'HSV', source: 'biblebrain' })
    // Audio only (nothing to read along with) or text only (likely a duplicate) are left out.
    expect(byId.has('bb-NLDNBV')).toBe(false)
    expect(byId.has('bb-NLDDSV')).toBe(false)
    expect(merged).toHaveLength(catalog.length + 1)
  })

  it('leaves the catalogue unchanged without Bible Brain', () => {
    expect(addBibleBrain(catalog, [])).toEqual(catalog)
  })
})
