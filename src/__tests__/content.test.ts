import { describe, expect, it } from 'vitest'
import type { ChapterItem } from '../api'
import { parseChapter } from '../content'

describe('parseChapter', () => {
  const items: ChapterItem[] = [
    { type: 'heading', content: ['The LORD Is My Shepherd'] },
    { type: 'hebrew_subtitle', content: ['A Psalm of David.'] },
    {
      type: 'verse',
      number: 1,
      content: [{ text: 'The LORD is my shepherd;', poem: 1 }, { noteId: 5 }, { text: 'I shall not want.', poem: 2 }],
    },
    { type: 'line_break' },
    { type: 'verse', number: 2, content: ['Prose ', { text: 'words', wordsOfJesus: true }] },
    { type: 'verse', number: 3, content: ['More prose.'] },
  ]

  it('splits headings, poetry and prose into blocks', () => {
    const { blocks } = parseChapter(items)
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'subtitle', 'para', 'para'])
    const [, , poem, prose] = blocks
    expect(poem).toMatchObject({ poetry: true, verses: [{ number: 1, index: 0 }] })
    expect(prose).toMatchObject({ poetry: false, verses: [{ number: 2, index: 1 }, { number: 3, index: 2 }] })
  })

  it('attaches footnote markers to the preceding text', () => {
    const { blocks } = parseChapter(items)
    const poem = blocks[2] as Extract<(typeof blocks)[number], { kind: 'para' }>
    expect(poem.verses[0].parts[0]).toMatchObject({ kind: 'text', notes: [5] })
    expect(poem.verses[0].parts).toHaveLength(2)
  })

  it('extracts plain verse text without footnote markers', () => {
    const { verses } = parseChapter(items)
    expect(verses).toEqual([
      { number: 1, text: 'The LORD is my shepherd; I shall not want.' },
      { number: 2, text: 'Prose words' },
      { number: 3, text: 'More prose.' },
    ])
  })
})
