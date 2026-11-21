import type { ChapterItem } from '../api'

// A passage's text as it goes on a card: the verses joined, tidied up to stand on their own.

/** Each verse's words, without headings, notes or a psalm's title. */
export function verseTexts(items: ChapterItem[]): { number: number; text: string }[] {
  const out: { number: number; text: string }[] = []
  for (const item of items) {
    if (item.type !== 'verse') continue
    const words = item.content
      .map((c) => (typeof c === 'string' ? c : 'text' in c && !c.descriptive ? c.text : ''))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    // A verse split across paragraphs comes in more than one piece.
    const previous = out.find((v) => v.number === item.number)
    if (previous) previous.text = `${previous.text} ${words}`.trim()
    else out.push({ number: item.number, text: words })
  }
  return out
}

/** A book's name in a reference: one psalm is a "Psalm" (English book lists say "Psalms"). */
export const bookLabel = (id: string, name: string) => (id === 'PSA' && name === 'Psalms' ? 'Psalm' : name)

/** The text of verses `first`–`last` from a chapter's verse list, or null if any is missing. */
export function passageText(verses: { number: number; text: string }[], first: number, last: number): string | null {
  const parts: string[] = []
  for (let n = first; n <= last; n++) {
    const verse = verses.find((v) => v.number === n)
    if (!verse?.text) return null
    parts.push(verse.text)
  }
  return parts.join(' ')
}

/**
 * Tidies a passage for a card:
 * - drops "Selah" (a musical note in the psalms) and bracketed quotation marks;
 * - starts it with a capital letter;
 * - ends it with an ellipsis where its sentence goes on;
 * - closes or opens quotation marks the verses leave open: a passage taken from the middle of
 *   a speech often has a closing mark without its opening one, or the other way round.
 */
export function cardText(text: string): string {
  let s = text
    .replace(/\s*\bSelah\b\.?/g, '')
    // Bracketed quotation marks close a speech that began chapters earlier (Matthew 6:34).
    .replace(/\[[“”‘’"']+\]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?”’])/g, '$1')
    .trim()
  s = s.replace(/^([“‘"'(\s]*)(\p{Ll})/u, (_, lead: string, c: string) => lead + c.toUpperCase())
  s = s.replace(/[\s,;:—–-]+$/u, '…')
  return balanceQuotes(s)
}

/** Adds the opening or closing double quotation marks a passage is missing. */
export function balanceQuotes(s: string): string {
  let open = 0
  let missingOpen = 0
  for (const c of s) {
    if (c === '“') open++
    else if (c === '”') {
      if (open) open--
      else missingOpen++
    }
  }
  let out = '“'.repeat(missingOpen) + s + '”'.repeat(open)
  // Straight quotes can't tell opening from closing: with an odd number, the first one decides
  // (a quote mark right after a word closes a quotation that started before the passage).
  const straight = [...out.matchAll(/"/g)]
  if (straight.length % 2 === 1) {
    const at = straight[0].index!
    const closes = at > 0 && /[\p{L}\p{N}.,;:!?…]/u.test(out[at - 1])
    out = closes ? `"${out}` : `${out}"`
  }
  return out
}
