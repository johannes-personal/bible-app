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
/**
 * Typing is still going on in the last word ("love one ano"): it's matched as the start of a
 * word. True when the text ends in a letter or digit.
 */
export const endsMidWord = (q: string) => /[\p{L}\p{N}']$/u.test(q)

/** Verses with the exact phrase (`partial`: its last word may go on, "ano" → "another"). */
export function findPhrase(verses: VerseText[], words: string[], partial = false): VerseText[] {
  if (!words.length) return []
  const needle = ` ${words.join(' ')}${partial ? '' : ' '}`
  return verses.filter((v) => v.words.includes(needle))
}

/** Verses with every word, each in any of its forms. */
/** Verses with every word, each in any of its forms (`partial`: the last word as a beginning). */
export function findAllWords(verses: VerseText[], forms: string[][], partial = false): VerseText[] {
  if (!forms.length) return []
  const sets = forms.map((f, i) => (partial && i === forms.length - 1 ? [` ${f[0]}`] : f.map((w) => ` ${w} `)))
  return verses.filter((v) => sets.every((alternatives) => alternatives.some((w) => v.words.includes(w))))
}

/** The verse's words that match (for marking), the last one completed when it's partial. */
export function matchedWords(v: VerseText, words: string[], forms: string[][], partial = false): string[] {
  const phrase = ` ${words.join(' ')}${partial ? '' : ' '}`
  const at = v.words.indexOf(phrase)
  if (at >= 0) {
    // The phrase as it stands in the verse, with its last word in full.
    const end = v.words.indexOf(' ', at + phrase.length - (partial ? 0 : 1))
    return [v.words.slice(at + 1, end < 0 ? undefined : end)]
  }
  const prefix = partial ? words.at(-1) : undefined
  const completed = prefix ? v.words.trim().split(' ').filter((t) => t.startsWith(prefix)) : []
  return [...forms.slice(0, partial ? -1 : undefined).flat(), ...completed]
}

/** The commonest way the verses complete a partial last word ("ano" → "another"). */
export function completion(verses: VerseText[], prefix: string): string {
  const counts = new Map<string, number>()
  for (const v of verses)
    for (const t of v.words.trim().split(' ')) if (t.startsWith(prefix)) counts.set(t, (counts.get(t) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? prefix
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
export function relevance(v: VerseText, words: string[], forms: string[][], partial = false): number {
  if (words.length && v.words.includes(` ${words.join(' ')}${partial ? '' : ' '}`)) return 1000
  const tokens = v.words.trim().split(' ')
  const sets = forms.map((f) => new Set(f))
  const last = forms.length - 1
  const matches = (t: string, k: number) => (partial && k === last ? t.startsWith(forms[k][0]) : sets[k].has(t))
  const hits: [number, number][] = [] // [position, which word]
  tokens.forEach((t, i) => sets.forEach((_, k) => matches(t, k) && hits.push([i, k])))
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
export function bestMatches(verses: VerseText[], words: string[], forms: string[][], limit = Infinity, partial = false): VerseText[] {
  return verses
    .map((v) => ({ v, score: relevance(v, words, forms, partial) }))
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
