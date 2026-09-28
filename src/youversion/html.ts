import type { ChapterItem, Footnote, VerseContent } from '../api'

// Converts YouVersion passage HTML into the Free Use Bible API's chapter format, so the
// reader, verse highlighting and text-to-speech work the same for both sources.
//
// The HTML is generated from USFM: block <div>s whose class is the paragraph marker
// (p, m, q1, q2, s1, d, b…), verse milestones <span class="yv-v" v="3"></span> followed by
// a label, words of Jesus in <span class="wj">, and footnotes in <span class="yv-n f">.

interface Element {
  tag: string
  classes: string[]
  attrs: Record<string, string>
  children: Node[]
}
type Node = Element | string

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

/** Parses the small, regular subset of HTML the API returns (div, span, and a few inline tags). */
export function parseHtml(html: string): Element {
  const root: Element = { tag: 'root', classes: [], attrs: {}, children: [] }
  const stack = [root]
  const token = /<(\/?)([a-z][a-z0-9]*)([^>]*?)(\/?)>|([^<]+)/gi
  let m: RegExpExecArray | null
  while ((m = token.exec(html))) {
    const [, closing, tagName, attrText, selfClosing, text] = m
    const top = stack[stack.length - 1]
    if (text !== undefined) {
      top.children.push(decode(text))
      continue
    }
    const tag = tagName.toLowerCase()
    if (closing) {
      // Pop back to the matching element; tolerate stray closing tags.
      const i = stack.map((e) => e.tag).lastIndexOf(tag)
      if (i > 0) stack.length = i
      continue
    }
    const attrs: Record<string, string> = {}
    for (const a of attrText.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)) attrs[a[1].toLowerCase()] = decode(a[2])
    const el: Element = { tag, classes: (attrs.class ?? '').split(/\s+/).filter(Boolean), attrs, children: [] }
    top.children.push(el)
    if (!selfClosing && tag !== 'br') stack.push(el)
  }
  return root
}

function textOf(node: Node, skip: (el: Element) => boolean = () => false): string {
  if (typeof node === 'string') return node
  if (skip(node)) return ''
  return node.children.map((c) => textOf(c, skip)).join('')
}

const isNote = (el: Element) => el.classes.includes('yv-n')
const HEADING = /^(s\d*|ms\d*|mr|sr|mt\d*|qa|sp|is\d*|imt\d*|iot)$/
const SKIP_BLOCK = /^(cl|r|rem|ide|toc\d*|h)$/
const POEM = /^(q|qm|li|pi|ph)(\d?)$/

export interface ParsedPassage {
  content: ChapterItem[]
  footnotes: Footnote[]
}

export function passageToChapter(html: string, chapter: number): ParsedPassage {
  const content: ChapterItem[] = []
  const footnotes: Footnote[] = []
  let verse: Extract<ChapterItem, { type: 'verse' }> | null = null

  const push = (part: VerseContent) => {
    if (!verse) return // text before the first verse (e.g. an introduction)
    const parts = verse.content
    const prev = parts[parts.length - 1]
    // Merge runs of text with the same formatting so spacing stays exactly as in the source.
    if (typeof part === 'string' && typeof prev === 'string') parts[parts.length - 1] = prev + part
    else if (
      typeof part === 'object' && 'text' in part && prev && typeof prev === 'object' && 'text' in prev &&
      prev.poem === part.poem && !!prev.wordsOfJesus === !!part.wordsOfJesus
    ) {
      parts[parts.length - 1] = { ...prev, text: prev.text + part.text }
    } else parts.push(part)
  }

  const addNote = (el: Element) => {
    const text = textOf(el, (c) => c.classes.includes('fr')).replace(/\s+/g, ' ').trim()
    if (!text || !verse) return
    const noteId = footnotes.length + 1
    footnotes.push({ noteId, caller: null, text, reference: { chapter, verse: verse.number } })
    return noteId
  }

  const newParagraph = () => {
    const last = content[content.length - 1]
    if (last && last.type === 'verse') content.push({ type: 'line_break' })
  }

  for (const block of blocksOf(parseHtml(html))) {
    const kind = block.classes.find((c) => c !== 'yv-h') ?? ''
    if (SKIP_BLOCK.test(kind)) continue
    if (block.classes.includes('yv-h') || HEADING.test(kind)) {
      const text = textOf(block, isNote).replace(/\s+/g, ' ').trim()
      if (text) content.push({ type: 'heading', content: [text] })
      continue
    }
    if (kind === 'd') {
      const text = textOf(block, isNote).replace(/\s+/g, ' ').trim()
      if (text) content.push({ type: 'hebrew_subtitle', content: [text] })
      continue
    }
    if (kind === 'b') {
      newParagraph()
      continue
    }

    const poemMatch = POEM.exec(kind)
    const poem = poemMatch ? Number(poemMatch[2] || 1) : undefined
    let startedNew = false
    // A poem line becomes one part per verse; notes inside it move to the line's end so
    // the line isn't split in two.
    let lineNotes: number[] = []

    const flushLineNotes = () => {
      for (const noteId of lineNotes) push({ noteId })
      lineNotes = []
    }

    const walk = (node: Node, jesus: boolean) => {
      if (typeof node === 'string') {
        if (!verse) return
        if (poem) push({ text: node, poem, ...(jesus ? { wordsOfJesus: true } : {}) })
        else push(jesus ? { text: node, wordsOfJesus: true } : node)
        return
      }
      if (node.classes.includes('yv-v')) {
        flushLineNotes()
        // Prose paragraphs start a new paragraph; poem lines flow on until a stanza break (b).
        if (!startedNew && !poem) newParagraph()
        startedNew = true
        const number = parseInt(node.attrs.v ?? '', 10)
        verse = { type: 'verse', number: Number.isFinite(number) ? number : 0, content: [] }
        content.push(verse)
        return
      }
      if (node.classes.includes('yv-vlbl')) return
      if (isNote(node)) {
        const noteId = addNote(node)
        if (noteId) {
          if (poem) lineNotes.push(noteId)
          else push({ noteId })
        }
        return
      }
      const wj = jesus || node.classes.includes('wj')
      for (const child of node.children) walk(child, wj)
    }

    // A paragraph that continues the previous verse starts on a new line.
    const first = block.children.find((c) => typeof c !== 'string' || c.trim())
    const continues = first !== undefined && !(typeof first !== 'string' && first.classes.includes('yv-v'))
    if (continues && verse) {
      // The previous verse's item already sits in the open paragraph, so verses that follow in
      // this block belong to it too.
      startedNew = true
      if (!poem) push({ lineBreak: true })
    }

    for (const child of block.children) walk(child, false)
    flushLineNotes()
  }

  for (const item of content) if (item.type === 'verse') item.content = tidy(item.content)
  return { content, footnotes }
}

/** The block-level divs, flattening the wrapper div the API puts around everything. */
function blocksOf(root: Element): Element[] {
  const out: Element[] = []
  const visit = (el: Element) => {
    for (const child of el.children) {
      if (typeof child === 'string') continue
      if (child.tag === 'div' && child.classes.length === 0) visit(child)
      else if (child.tag === 'div') out.push(child)
    }
  }
  visit(root)
  return out
}

/** Collapses whitespace inside parts and drops empty ones and trailing line breaks. */
function tidy(parts: VerseContent[]): VerseContent[] {
  const out: VerseContent[] = []
  for (const p of parts) {
    if (typeof p === 'string') {
      const text = p.replace(/\s+/g, ' ')
      if (text.trim()) out.push(text)
    } else if ('text' in p) {
      const text = p.text.replace(/\s+/g, ' ')
      if (text.trim()) out.push(p.poem ? { ...p, text: text.trim() } : { ...p, text })
    } else out.push(p)
  }
  while (out.length && typeof out[out.length - 1] === 'object' && 'lineBreak' in (out[out.length - 1] as object)) out.pop()
  if (typeof out[0] === 'string') out[0] = out[0].trimStart()
  const last = out.length - 1
  if (typeof out[last] === 'string') out[last] = (out[last] as string).trimEnd()
  return out
}
