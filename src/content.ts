import type { ChapterItem, VerseContent } from './api'

// Turns the API's flat chapter content into paragraphs for rendering,
// plus the plain text of every verse for text-to-speech.

export type Part =
  | { kind: 'text'; text: string; poem?: number; jesus?: boolean; notes?: number[] }
  | { kind: 'break' }
  | { kind: 'heading'; text: string }
  | { kind: 'note'; noteId: number }

export interface VerseBlock {
  number: number
  /** Position of this verse within the chapter (0-based); matches audio timings. */
  index: number
  parts: Part[]
}

export type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'subtitle'; parts: Part[] }
  | { kind: 'para'; poetry: boolean; verses: VerseBlock[] }

export interface ParsedChapter {
  blocks: Block[]
  /** Plain text of each verse, in chapter order. */
  verses: { number: number; text: string }[]
}

function toParts(content: VerseContent[]): Part[] {
  const parts: Part[] = []
  for (const c of content) {
    const prev = parts[parts.length - 1]
    if (typeof c === 'string') parts.push({ kind: 'text', text: c })
    else if ('text' in c) parts.push({ kind: 'text', text: c.text, poem: c.poem, jesus: c.wordsOfJesus })
    else if ('heading' in c) parts.push({ kind: 'heading', text: c.heading })
    // Attach footnote markers to the text they follow so they stay on its line.
    else if ('noteId' in c) {
      if (prev?.kind === 'text') prev.notes = [...(prev.notes ?? []), c.noteId]
      else parts.push({ kind: 'note', noteId: c.noteId })
    } else parts.push({ kind: 'break' })
  }
  return parts
}

export function plainText(parts: Part[]): string {
  return parts
    .map((p) => (p.kind === 'text' ? p.text : ''))
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseChapter(items: ChapterItem[]): ParsedChapter {
  const blocks: Block[] = []
  const verses: ParsedChapter['verses'] = []
  let para: Extract<Block, { kind: 'para' }> | null = null

  for (const item of items) {
    switch (item.type) {
      case 'heading':
        para = null
        blocks.push({ kind: 'heading', text: item.content.join(' ') })
        break
      case 'hebrew_subtitle':
        para = null
        blocks.push({ kind: 'subtitle', parts: toParts(item.content) })
        break
      case 'line_break':
        para = null
        break
      case 'verse': {
        const parts = toParts(item.content)
        const poetry = parts.some((p) => p.kind === 'text' && p.poem)
        // Keep prose and poetry in separate paragraphs so they lay out differently.
        if (!para || para.poetry !== poetry) {
          para = { kind: 'para', poetry, verses: [] }
          blocks.push(para)
        }
        para.verses.push({ number: item.number, index: verses.length, parts })
        verses.push({ number: item.number, text: plainText(parts) })
        break
      }
    }
  }
  return { blocks, verses }
}
