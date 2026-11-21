import { describe, expect, it } from 'vitest'
import type { ChapterItem } from '../api'
import { hashString, SCENE_KINDS, sceneFor, seeded } from '../inspiration/art'
import { feedOrder, PASSAGES, passagesFor, TOPICS, type Passage } from '../inspiration/feed'
import { imageName } from '../inspiration/image'
import { balanceQuotes, bookLabel, cardText, passageText, verseTexts } from '../inspiration/text'
import { hashFor, inspireHash, parseHash, parseInspireHash } from '../route'

const passage = (key: string, tier: 1 | 2 | 3): Passage => ({ key, book: 'PSA', chapter: 1, first: 1, last: 1, tier, topics: ['hope'] })

describe('the verse list', () => {
  it('has three tiers, the first two of 400 and 700, nearly every passage with a topic', () => {
    const count = (tier: number) => PASSAGES.filter((p) => p.tier === tier).length
    expect(count(1)).toBe(400)
    expect(count(2)).toBe(700)
    expect(count(3)).toBeGreaterThan(100)
    expect(new Set(PASSAGES.map((p) => p.key)).size).toBe(PASSAGES.length)
    for (const p of PASSAGES) expect(p.last).toBeGreaterThanOrEqual(p.first)
    // A few were chosen for being encouraging in general: they only show under "All".
    expect(PASSAGES.filter((p) => !p.topics.length).length).toBeLessThan(PASSAGES.length / 50)
  })

  it('has well-known verses in tier 1, and something for every topic', () => {
    for (const key of ['JHN.3.16', 'PSA.23.1', 'ISA.40.31', 'PHP.4.12-13']) {
      expect(PASSAGES.find((p) => p.key === key)?.tier, key).toBe(1)
    }
    for (const topic of TOPICS) expect(passagesFor(topic).filter((p) => p.tier === 1).length, topic).toBeGreaterThan(30)
  })

  it('leaves out verses usually read out of context', () => {
    for (const key of ['JER.29.11', 'MAT.18.20', 'PHP.4.13', 'JOB.8.7']) expect(PASSAGES.some((p) => p.key === key), key).toBe(false)
  })

  it('keeps to the books a translation has', () => {
    const nt = passagesFor(null, new Set(['MAT', 'JHN', 'ROM']))
    expect(nt.length).toBeGreaterThan(0)
    expect(nt.every((p) => ['MAT', 'JHN', 'ROM'].includes(p.book))).toBe(true)
  })
})

describe('feedOrder', () => {
  const list = [passage('a3', 3), passage('a1', 1), passage('b2', 2), passage('b1', 1), passage('c3', 3)]

  it('shows tier 1, then 2, then 3, leaving seen ones to the end (least recently seen first)', () => {
    const order = feedOrder(list, ['c3', 'a1'], seeded(1)).map((p) => p.key)
    expect(order.slice(0, 3)).toEqual(['b1', 'b2', 'a3'])
    expect(order.slice(3)).toEqual(['c3', 'a1'])
  })

  it('starts over once everything has been seen, holding back the most recent', () => {
    const order = feedOrder(list, ['a3', 'a1', 'b2', 'b1', 'c3'], seeded(2)).map((p) => p.key)
    expect(order).toHaveLength(5)
    expect(order.at(-1)).toBe('c3')
    expect(order.slice(0, 2).sort()).toEqual(['a1', 'b1'])
  })

  it('shuffles within a tier', () => {
    const many = Array.from({ length: 30 }, (_, i) => passage(`p${i}`, 1))
    const a = feedOrder(many, [], seeded(1)).map((p) => p.key)
    const b = feedOrder(many, [], seeded(2)).map((p) => p.key)
    expect(a).not.toEqual(b)
    expect([...a].sort()).toEqual([...b].sort())
  })
})

describe('card text', () => {
  it('takes the verses without psalm titles, notes or headings', () => {
    const items: ChapterItem[] = [
      { type: 'heading', content: ['God Is Our Refuge'] },
      {
        type: 'verse',
        number: 1,
        content: [
          { text: 'For the choirmaster.', descriptive: true },
          { noteId: 3 },
          { lineBreak: true },
          { text: 'God is our refuge and strength,', poem: 1 },
          { text: 'an ever-present help in times of trouble.', poem: 2 },
        ],
      },
      { type: 'verse', number: 2, content: ['Therefore we will not fear.'] },
      { type: 'verse', number: 2, content: ['(continued)'] },
    ]
    const verses = verseTexts(items)
    expect(verses[0].text).toBe('God is our refuge and strength, an ever-present help in times of trouble.')
    expect(verses[1].text).toBe('Therefore we will not fear. (continued)')
    expect(passageText(verses, 1, 2)).toContain('strength, an ever-present')
    expect(passageText(verses, 1, 3)).toBeNull()
  })

  it('tidies a passage to stand on its own', () => {
    expect(cardText('being confident of this, that He who began a good work in you will carry it on.')).toBe(
      'Being confident of this, that He who began a good work in you will carry it on.',
    )
    expect(cardText('To everything there is a season, and a time for every purpose under heaven:')).toBe(
      'To everything there is a season, and a time for every purpose under heaven…',
    )
    expect(cardText('Trust in Him at all times. Selah And pour out your hearts.')).toBe('Trust in Him at all times. And pour out your hearts.')
    expect(cardText('Today has enough trouble of its own.[’’]')).toBe('Today has enough trouble of its own.')
  })

  it('opens and closes quotations left open by the verses', () => {
    expect(balanceQuotes('‘He will wipe away every tear,’ and the former things have passed away.”')).toBe(
      '“‘He will wipe away every tear,’ and the former things have passed away.”',
    )
    expect(balanceQuotes('“Be still and know that I am God;')).toBe('“Be still and know that I am God;”')
    expect(balanceQuotes('“Peace I leave with you.”')).toBe('“Peace I leave with you.”')
    expect(balanceQuotes('I will help you," declares the LORD.')).toBe('"I will help you," declares the LORD.')
  })
})

describe('routes', () => {
  it('reads and writes a passage of several verses', () => {
    const ref = parseHash('#/BSB/PHP/4/6-7')
    expect(ref).toEqual({ translationId: 'BSB', book: 'PHP', chapter: 4, verse: 6, verseEnd: 7 })
    expect(hashFor(ref!)).toBe('#/BSB/PHP/4/6-7')
    expect(parseHash('#/BSB/PHP/4/6')).toEqual({ translationId: 'BSB', book: 'PHP', chapter: 4, verse: 6 })
  })

  it('has inspiration mode, with or without a topic', () => {
    expect(parseInspireHash('#/inspire')).toEqual({ topic: null })
    expect(parseInspireHash('#/inspire/hope')).toEqual({ topic: 'hope' })
    expect(parseInspireHash('#/BSB/JHN/3')).toBeNull()
    expect(inspireHash('peace')).toBe('#/inspire/peace')
    expect(parseHash('#/inspire/hope')).toBeNull()
  })
})

describe('art and images', () => {
  it('gives a passage the same scene every time, of the kind chosen for it', () => {
    expect(sceneFor('JHN.3.16', 'lake')).toEqual(sceneFor('JHN.3.16', 'lake'))
    expect(sceneFor('JHN.3.16', 'lake').kind).toBe('lake')
    expect(hashString('a')).not.toBe(hashString('b'))
  })

  it('matches scenes to what passages say, with plenty of variety', () => {
    const scene = (key: string) => PASSAGES.find((p) => p.key === key)?.scene
    expect(scene('PSA.23.1')).toBe('meadow')
    expect(scene('ISA.40.31')).toBe('sky')
    expect(scene('PSA.119.105')).toBe('path')
    expect(scene('PSA.4.8')).toBe('night')
    expect(PASSAGES.every((p) => p.scene && SCENE_KINDS.includes(p.scene))).toBe(true)
    const counts = new Map<string, number>()
    for (const p of PASSAGES) counts.set(p.scene!, (counts.get(p.scene!) ?? 0) + 1)
    expect(counts.size).toBeGreaterThanOrEqual(12)
    // No one kind of scene takes over.
    expect(Math.max(...counts.values())).toBeLessThan(PASSAGES.length * 0.2)
  })

  it('calls one psalm a Psalm', () => {
    expect(bookLabel('PSA', 'Psalms')).toBe('Psalm')
    expect(bookLabel('PSA', 'Psaltaren')).toBe('Psaltaren')
    expect(bookLabel('JHN', 'John')).toBe('John')
  })

  it('names images after the reference', () => {
    expect(imageName('John 3:16')).toBe('John-3-16.jpg')
    expect(imageName('Philippians 4:6–7')).toBe('Philippians-4-6-7.jpg')
    expect(imageName('Psaltaren 23:1')).toBe('Psaltaren-23-1.jpg')
  })
})
