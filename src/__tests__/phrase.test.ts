import { describe, expect, it } from 'vitest'
import { findAllWords, findPhrase, isPhrase, parseQuery, parseVerseText, wordsOf } from '../wordstudy/phrase'
import { parseStudyHash, studyHash } from '../route'

const verses = parseVerseText(
  [
    '42013034\tA new commandment I give you: Love one another. As I have loved you, so you also must love one another.',
    '44012010\tBe devoted to one another in love. Outdo yourselves in honoring one another.',
    '61003023\tAnd this is His commandment: that we should believe in the name of His Son, Jesus Christ, and love one another, just as He commanded us.',
    '42003029\tThe friend of the bridegroom … is overjoyed to hear the bridegroom’s voice.',
  ].join('\n'),
)

describe('phrase search', () => {
  it('splits text into words, keeping apostrophes', () => {
    expect(wordsOf('the bridegroom’s voice. “Love,” he said')).toEqual(['the', "bridegroom's", 'voice', 'love', 'he', 'said'])
  })

  it('tells phrases from single words', () => {
    expect(isPhrase('love')).toBe(false)
    expect(isPhrase('love one another')).toBe(true)
    expect(isPhrase('"love"')).toBe(true)
    expect(parseQuery('“love one another”')).toEqual({ words: ['love', 'one', 'another'], quoted: true })
  })

  it('finds the exact phrase, ignoring case and punctuation', () => {
    expect(findPhrase(verses, ['love', 'one', 'another']).map((v) => v.code)).toEqual([42013034, 61003023])
    expect(findPhrase(verses, ["bridegroom's", 'voice']).map((v) => v.code)).toEqual([42003029])
  })

  it('finds all the words, in any of their forms', () => {
    const forms = [['love', 'loved', 'loving'], ['one'], ['another']]
    expect(findAllWords(verses, forms).map((v) => v.code)).toEqual([42013034, 44012010, 61003023])
  })

  it('has its own address', () => {
    expect(parseStudyHash('#/study/q/love%20one%20another')).toEqual({ kind: 'search', query: 'love one another' })
    expect(parseStudyHash('#/study/q/love%20one%20another/words')).toEqual({ kind: 'search', query: 'love one another', mode: 'words' })
    expect(studyHash({ kind: 'search', query: 'love one another', mode: 'phrase' })).toBe('#/study/q/love%20one%20another/phrase')
  })
})
