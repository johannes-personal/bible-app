import { describe, expect, it } from 'vitest'
import { parseChapter } from '../content'
import { passageToChapter } from '../youversion/html'

// Synthetic samples with the same structure as YouVersion passage HTML.
const PROSE =
  '<div><div class="s1 yv-h">A Heading</div>' +
  '<div class="p"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>First verse &amp; more. ' +
  '<span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>He said, <span class="wj">“Truly I tell you.</span>' +
  '<span class="yv-n f"><span class="fr">1:2 </span><span class="ft">Or </span><span class="fqa">verily</span></span>' +
  '<span class="wj">”</span></div>' +
  '<div class="p">Continued second verse. <span class="yv-v" v="3"></span><span class="yv-vlbl">3</span>The <span class="nd">Lord</span> spoke.</div></div>'

const POETRY =
  '<div><div class="cl yv-h">Psalm 1</div><div class="d">A psalm.</div>' +
  '<div class="q1"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>Line one,</div>' +
  '<div class="q2">line two<span class="yv-n f"><span class="fr">1:1 </span><span class="ft">A note</span></span> ends.</div>' +
  '<div class="b"></div>' +
  '<div class="q1"><span class="yv-v" v="2"></span><span class="yv-vlbl">2</span>Next stanza.</div></div>'

describe('passageToChapter', () => {
  it('converts prose: headings, verses, words of Jesus, notes and continued paragraphs', () => {
    const { content, footnotes } = passageToChapter(PROSE, 1)
    expect(content[0]).toEqual({ type: 'heading', content: ['A Heading'] })
    const verses = content.filter((c) => c.type === 'verse')
    expect(verses.map((v) => v.number)).toEqual([1, 2, 3])
    expect(verses[0].content).toEqual(['First verse & more.'])
    expect(verses[1].content).toEqual([
      'He said, ',
      { text: '“Truly I tell you.', wordsOfJesus: true },
      { noteId: 1 },
      { text: '”', wordsOfJesus: true },
      { lineBreak: true },
      'Continued second verse.',
    ])
    expect(verses[2].content).toEqual(['The Lord spoke.'])
    expect(footnotes).toEqual([{ noteId: 1, caller: null, text: 'Or verily', reference: { chapter: 1, verse: 2 } }])
    // Verse 3 starts a new paragraph mid-block, so no break before it; the block start is the break.
    expect(content.filter((c) => c.type === 'line_break')).toHaveLength(0)
  })

  it('converts poetry: subtitle, indented lines, stanza breaks, notes at line end', () => {
    const { content } = passageToChapter(POETRY, 1)
    expect(content.map((c) => c.type)).toEqual(['hebrew_subtitle', 'verse', 'line_break', 'verse'])
    const [, v1, , v2] = content
    expect(v1).toMatchObject({
      number: 1,
      content: [{ text: 'Line one,', poem: 1 }, { text: 'line two ends.', poem: 2 }, { noteId: 1 }],
    })
    expect(v2).toMatchObject({ number: 2, content: [{ text: 'Next stanza.', poem: 1 }] })
  })

  it('produces content the reader and text-to-speech understand', () => {
    const { verses, blocks } = parseChapter(passageToChapter(POETRY, 1).content)
    expect(verses).toEqual([
      { number: 1, text: 'Line one, line two ends.' },
      { number: 2, text: 'Next stanza.' },
    ])
    expect(blocks.filter((b) => b.kind === 'para').every((b) => b.kind === 'para' && b.poetry)).toBe(true)
  })
})
