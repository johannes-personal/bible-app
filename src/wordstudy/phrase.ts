import { loadEnglish } from './data'

// Finding verses by a phrase: in the BSB's text, either the exact phrase (its words in order,
// ignoring case and punctuation) or all of its words anywhere in the verse (with their other
// forms: "love" also finds "loved" and "loving").

export interface VerseText {
  /** Verse code, as in the word index. */
  code: number
  text: string
  /** Lowercase words separated by single spaces, with a space at each end. */
  words: string
}

/** Lowercase words, apostrophes kept inside words ("bridegroom’s" → "bridegroom's"). */
export function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .split(/[^\p{L}\p{N}']+/u)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
}

export interface Query {
  words: string[]
  /** Written in quotes: only the exact phrase is wanted. */
  quoted: boolean
}

export function parseQuery(q: string): Query {
  const trimmed = q.trim()
  return { words: wordsOf(trimmed), quoted: /^["“”].*["“”]$/.test(trimmed) }
}

/** Two or more words (or a quoted phrase) are a search for verses rather than a word. */
export const isPhrase = (q: string) => {
  const { words, quoted } = parseQuery(q)
  return words.length > 1 || (quoted && words.length > 0)
}

export function parseVerseText(file: string): VerseText[] {
  const out: VerseText[] = []
  for (const line of file.split('\n')) {
    const tab = line.indexOf('\t')
    if (tab < 0) continue
    const text = line.slice(tab + 1)
    out.push({ code: Number(line.slice(0, tab)), text, words: ` ${wordsOf(text).join(' ')} ` })
  }
  return out
}

let verseText: Promise<VerseText[]> | null = null

/** The BSB's text, loaded once (about 1.3 MB compressed) the first time verses are searched. */
export function loadVerseText(): Promise<VerseText[]> {
  verseText ??= fetch(new URL('word-study/text.txt', document.baseURI))
    .then((r) => {
      if (!r.ok) throw new Error("The verse text couldn't be loaded.")
      return r.text()
    })
    .then(parseVerseText)
  verseText.catch(() => (verseText = null))
  return verseText
}

/** Verses with the exact phrase. */
export function findPhrase(verses: VerseText[], words: string[]): VerseText[] {
  if (!words.length) return []
  const needle = ` ${words.join(' ')} `
  return verses.filter((v) => v.words.includes(needle))
}

/** Verses with every word, each in any of its forms. */
export function findAllWords(verses: VerseText[], forms: string[][]): VerseText[] {
  if (!forms.length) return []
  const sets = forms.map((f) => f.map((w) => ` ${w} `))
  return verses.filter((v) => sets.every((alternatives) => alternatives.some((w) => v.words.includes(w))))
}

/** Each word with its other forms in the BSB ("love": love, loved, loves, loving…). */
export async function formsOf(words: string[]): Promise<string[][]> {
  return Promise.all(
    words.map(async (w) => {
      const english = await loadEnglish(w).catch(() => null)
      const forms = english ? Object.keys(english.entry.forms) : []
      return [...new Set([w, ...forms.map((f) => f.toLowerCase())])]
    }),
  )
}

/**
 * How well a verse matches: the exact phrase best; otherwise all the words, the closer
 * together the better, and better still in the order searched for. 0 if a word is missing.
 */
export function relevance(v: VerseText, words: string[], forms: string[][]): number {
  if (words.length && v.words.includes(` ${words.join(' ')} `)) return 1000
  const tokens = v.words.trim().split(' ')
  const sets = forms.map((f) => new Set(f))
  const hits: [number, number][] = [] // [position, which word]
  tokens.forEach((t, i) => sets.forEach((s, k) => s.has(t) && hits.push([i, k])))
  // The shortest stretch of the verse with every word in it.
  const need = sets.length
  const counts = new Array<number>(need).fill(0)
  let have = 0
  let best: [number, number] | null = null
  for (let lo = 0, hi = 0; hi < hits.length; hi++) {
    if (counts[hits[hi][1]]++ === 0) have++
    while (have === need) {
      const span: [number, number] = [hits[lo][0], hits[hi][0]]
      if (!best || span[1] - span[0] < best[1] - best[0]) best = span
      if (--counts[hits[lo][1]] === 0) have--
      lo++
    }
  }
  if (!best) return 0
  // In order: each word first appears (within the stretch) after the one before it.
  const firsts = sets.map((_, k) => hits.find(([p, w]) => w === k && p >= best[0] && p <= best[1])?.[0] ?? 0)
  const inOrder = firsts.every((p, k) => k === 0 || p > firsts[k - 1])
  return 500 - Math.min(best[1] - best[0], 400) + (inOrder ? 50 : 0)
}

/** The verses that match best, best first (in Bible order when equally good). */
export function bestMatches(verses: VerseText[], words: string[], forms: string[][], limit = Infinity): VerseText[] {
  return verses
    .map((v) => ({ v, score: relevance(v, words, forms) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.v.code - b.v.code)
    .slice(0, limit)
    .map((r) => r.v)
}

/** The part of a long verse around its first matching word, for a one- or two-line preview. */
export function snippet(text: string, words: string[], max = 120): string {
  if (text.length <= max) return text
  const lower = text.toLowerCase().replace(/[’‘]/g, "'")
  // Around the whole phrase when the verse has it, else around the first word found.
  const candidates = words.length > 1 ? [words.join(' '), ...words] : words
  const at =
    candidates
      .map((w) => lower.search(new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\p{P}]+')}`, 'u')))
      .find((i) => i >= 0) ?? 0
  let start = Math.max(0, at - 30)
  if (start > 0) start = text.indexOf(' ', start) + 1 || start
  const end = Math.min(text.length, start + max)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}
