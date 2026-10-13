import { describe, expect, it } from 'vitest'
import { referenceFinder, referenceLabel } from '../references'

const find = (text: string, books = []) =>
  referenceFinder(books).find(text).map((r) => ({
    text: text.slice(r.start, r.end),
    ref: `${r.book} ${r.chapter}:${r.verseStart}${r.verseEnd !== r.verseStart ? '-' + r.verseEnd : ''}`,
  }))

describe('referenceFinder', () => {
  it('finds English references with full names, ranges and numbered books', () => {
    expect(find('Deuteronomy 8:3')).toEqual([{ text: 'Deuteronomy 8:3', ref: 'DEU 8:3' }])
    expect(find('Psalms 91:11–12').map((r) => r.ref)).toEqual(['PSA 91:11-12'])
    expect(find('2 Samuel 7:14; 1 Chronicles 17:13').map((r) => r.ref)).toEqual(['2SA 7:14', '1CH 17:13'])
    expect(find('Psalms 14:1–3 and Psalms 53:1–3 (see also LXX)').map((r) => r.ref)).toEqual(['PSA 14:1-3', 'PSA 53:1-3'])
  })

  it('finds references mixed with other text', () => {
    expect(find('Or when You are judged; Psalms 51:4 (see also LXX)')).toEqual([{ text: 'Psalms 51:4', ref: 'PSA 51:4' }])
    expect(find('Psalms 2:7; literally today I have begotten You').map((r) => r.ref)).toEqual(['PSA 2:7'])
  })

  it('handles abbreviations, Swedish names and "f."/"ff."', () => {
    expect(find('5 Mos 8:3.')).toEqual([{ text: '5 Mos 8:3', ref: 'DEU 8:3' }])
    expect(find('Ps 91:11f.')).toEqual([{ text: 'Ps 91:11f.', ref: 'PSA 91:11-12' }])
    expect(find('Matt. 5:3ff.').map((r) => r.ref)).toEqual(['MAT 5:3-5'])
    expect(find('1Kor 13:4').map((r) => r.ref)).toEqual(['1CO 13:4'])
  })

  it('continues a list without repeating the book', () => {
    expect(find('Matt 5:3; 6:9, 10:1').map((r) => r.ref)).toEqual(['MAT 5:3', 'MAT 6:9', 'MAT 10:1'])
  })

  it('ignores numbers that are not references', () => {
    expect(find('At 3:30 in the afternoon')).toEqual([])
    expect(find('Ps 91:11 for the Lord')).toEqual([{ text: 'Ps 91:11', ref: 'PSA 91:11' }])
    expect(find('TR reads “Jesus” instead of “he”')).toEqual([])
  })

  it('resolves "(see 12:25)" style references to the current book', () => {
    const f = referenceFinder()
    const refs = (t: string) => f.find(t, 'ACT').map((r) => `${r.book} ${r.chapter}:${r.verseStart}`)
    expect(refs('Dvs Johannes Markus (se 12:25), Markusevangeliets författare.')).toEqual(['ACT 12:25'])
    expect(refs('"världarna" (även i 11:3).')).toEqual(['ACT 11:3'])
    expect(refs('At 3:30 in the afternoon')).toEqual([])
    expect(f.find('(se 12:25)').length).toBe(0) // no current book given
  })

  it("uses the translation's own book names", () => {
    const books = [{ id: 'JHN', name: 'Johannesevangeliet', commonName: 'Johannes', order: 43, numberOfChapters: 21 }]
    expect(find('Johannes 3:16', books as never).map((r) => r.ref)).toEqual(['JHN 3:16'])
    expect(referenceLabel(referenceFinder().find('Joh 3:16-17')[0], books)).toBe('Johannesevangeliet 3:16–17')
  })
})
