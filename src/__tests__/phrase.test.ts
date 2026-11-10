import { describe, expect, it } from 'vitest'
import { bestMatches, findAllWords, findPhrase, isPhrase, parseQuery, parseVerseText, relevance, snippet, wordsOf } from '../wordstudy/phrase'
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

describe('ranking verses', () => {
  const v = (code: number, text: string) => parseVerseText(`${code}\t${text}`)[0]
  const words = ['for', 'god', 'so', 'loved']
  const forms = [['for'], ['god'], ['so'], ['love', 'loved', 'loves']]

  it('puts the exact phrase first, then the words closest together and in order', () => {
    const exact = v(42003016, 'For God so loved the world that He gave His one and only Son')
    const near = v(61004011, 'Beloved, if God so loved us, we also ought to love one another, for')
    const scattered = v(5007009, 'Know therefore that the LORD your God is God, the faithful God, who keeps His covenant of loving devotion for a thousand generations of those who love Him and keep His commandments, so')
    const ranked = bestMatches([scattered, near, exact], words, forms)
    expect(ranked.map((x) => x.code)).toEqual([42003016, 61004011, 5007009])
    expect(relevance(exact, words, forms)).toBeGreaterThan(relevance(near, words, forms))
    expect(relevance(v(1, 'God is good'), words, forms)).toBe(0)
  })

  it('previews a long verse around the match', () => {
    const long = 'Then the LORD said to Moses, “Go to Pharaoh and tell him that this is what the LORD says: Let My people go, so that they may worship Me, and so on and so forth for many more words here.'
    const s = snippet(long, ['people', 'go'], 60)
    expect(s.startsWith('…')).toBe(true)
    expect(s).toContain('Let My people go')
    expect(snippet('Jesus wept.', ['wept'])).toBe('Jesus wept.')
    const thess = 'Now about brotherly love, you do not need anyone to write to you, because you yourselves have been taught by God to love one another.'
    expect(snippet(thess, ['love', 'one', 'another'], 60)).toContain('love one another')
  })
})
