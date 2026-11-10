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
