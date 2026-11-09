import type { ChapterRef } from '../api'
import { DEFAULT_TRANSLATION, hashFor, LAST_KEY } from '../route'
import { load as loadStored } from '../storage'

// The word study index, built by scripts/build-word-study.mjs into public/word-study/ and
// served as static files. Everything is loaded on demand and kept for the session.

/** Original-language words per chapter, by book, for usage per 1,000 words. */
export interface Meta {
  totalVerses: number
  sections: string[]
  books: { id: string; name: string; section: number; words: number[] }[]
}

/** [lemma, transliteration, short gloss, occurrences, language: h(ebrew), a(ramaic) or g(reek)] */
export type NameEntry = [string, string, string, number, 'h' | 'a' | 'g']

export interface WordEntry {
  /** English renderings in the BSB and how often each is used. */
  renderings: [string, number][]
  /** Flat pairs: verse code (see `decodeVerse`), rendering index (-1: no English word of its own). */
  occurrences: number[]
  /** Words most often found in the same verses: [Strong's number, shared verses, strength]. */
  related: [string, number, number][]
}

/**
 * A word's lexicon entry. Text fields use a small markup the app renders: <b>, <i>,
 * [[r:MAT.9.37|Mat 9:37]] for a verse and [[w:H2616]] for another word.
 */
export interface LexiconEntry {
  partOfSpeech: string
  pronunciation: string
  /** Dictionary forms (Greek), e.g. "ἀγάπη, -ης, ἡ". */
  forms: string
  /** Where the word comes from, from Strong's, e.g. "from [[w:H2616]]". */
  root: string
  /** Strong's definition. */
  strongs: string
  /** How the KJV translates it, from Strong's. */
  kjv: string
  /** STEPBible senses: [depth, label ("1a", "(b)"), text]. */
  senses: [number, string, string][]
  notes: string[]
}

export interface EnglishEntry {
  total: number
  forms: Record<string, number>
  /** [Strong's number, occurrences, indexes of its renderings that contain the word] */
  strongs: [string, number, number[]][]
  /** Other English words for the same Hebrew and Greek words: [word, shared uses, Strong's numbers they share most]. */
  related: [string, number, string[]][]
}

const cache = new Map<string, Promise<unknown>>()

function load<T>(file: string): Promise<T> {
  let p = cache.get(file) as Promise<T> | undefined
  if (!p) {
    p = fetch(new URL(`word-study/${file}`, document.baseURI)).then((r) => {
      if (!r.ok) throw new Error("The word study data couldn't be loaded.")
      return r.json() as Promise<T>
    })
    p.catch(() => cache.delete(file))
    cache.set(file, p)
  }
  return p
}

export const loadMeta = () => load<Meta>('meta.json')

export async function loadLexicon(strongs: string): Promise<LexiconEntry | null> {
  const bucket = await load<Record<string, LexiconEntry>>(`l/${strongs.slice(0, 3)}.json`)
  return bucket[strongs] ?? null
}
export const loadNames = () => load<Record<string, NameEntry>>('names.json')

export async function loadWord(strongs: string): Promise<WordEntry | null> {
  const bucket = await load<Record<string, WordEntry>>(`s/${strongs.slice(0, 3)}.json`).catch(() => null)
  return bucket?.[strongs] ?? null
}

const letterOf = (word: string) => (/^[a-z]/.test(word) ? word[0] : '_')

/** The English entry for a word or one of its forms ("loved" finds "love"). */
export async function loadEnglish(word: string): Promise<{ lemma: string; entry: EnglishEntry } | null> {
  const w = word.trim().toLowerCase()
  if (!w) return null
  const bucket = await load<Record<string, EnglishEntry>>(`e/${letterOf(w)}.json`).catch(() => null)
  if (!bucket) return null
  if (bucket[w]) return { lemma: w, entry: bucket[w] }
  for (const [lemma, entry] of Object.entries(bucket)) if (w in entry.forms) return { lemma, entry }
  return null
}

/** English words starting with the query, most used first. */
export async function suggestEnglish(query: string, limit = 6): Promise<{ lemma: string; total: number }[]> {
  const q = query.trim().toLowerCase()
  if (!q || !/^[a-z]/.test(q)) return []
  const bucket = await load<Record<string, EnglishEntry>>(`e/${letterOf(q)}.json`).catch(() => null)
  if (!bucket) return []
  return Object.entries(bucket)
    .filter(([lemma, e]) => lemma.startsWith(q) || Object.keys(e.forms).some((f) => f.startsWith(q)))
    .map(([lemma, e]) => ({ lemma, total: e.total }))
    .sort((a, b) => Number(b.lemma === q) - Number(a.lemma === q) || b.total - a.total)
    .slice(0, limit)
}

/** Lowercase, without accents, breathings or Hebrew vowel points: "agapē" and "agape" match. */
export const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')

/** Hebrew and Greek words whose transliteration, lemma, gloss or number matches the query. */
export function suggestOriginal(names: Record<string, NameEntry>, query: string, limit = 6): string[] {
  const q = fold(query)
  if (q.length < 2) return []
  const scored: [string, number][] = []
  for (const [strongs, [lemma, translit, gloss, count]] of Object.entries(names)) {
    const t = fold(translit)
    let score = 0
    if (t === q || fold(lemma) === q) score = 3
    else if (t.startsWith(q)) score = 2
    else if (fold(gloss).startsWith(q)) score = 1
    if (score) scored.push([strongs, score * 100000 + count])
  }
  return scored.sort((a, b) => b[1] - a[1]).slice(0, limit).map(([s]) => s)
}

export interface Occurrence {
  book: number
  chapter: number
  verse: number
  /** Index into the word's renderings, or -1. */
  rendering: number
  strongs: string
}

export const decodeVerse = (code: number) => ({
  book: Math.floor(code / 1_000_000),
  chapter: Math.floor(code / 1000) % 1000,
  verse: code % 1000,
})

export function occurrencesOf(strongs: string, entry: WordEntry, renderings?: number[]): Occurrence[] {
  const out: Occurrence[] = []
  const only = renderings && new Set(renderings)
  for (let i = 0; i < entry.occurrences.length; i += 2) {
    const rendering = entry.occurrences[i + 1]
    if (only && !only.has(rendering)) continue
    out.push({ ...decodeVerse(entry.occurrences[i]), rendering, strongs })
  }
  return out
}

export const formatCount = (n: number) => n.toLocaleString('en-US')

export const LANGUAGE_NAMES = { h: 'Hebrew', a: 'Aramaic', g: 'Greek' } as const

export const verseKey = (o: { book: number; chapter: number; verse: number }) => o.book * 1_000_000 + o.chapter * 1000 + o.verse
export const byPosition = (a: Occurrence, b: Occurrence) => a.book - b.book || a.chapter - b.chapter || a.verse - b.verse

/** A link to a verse (or chapter) in the reader, in the translation last read in. */
export function verseHash(meta: Meta, o: { book: number; chapter: number; verse?: number }) {
  const translationId = loadStored<ChapterRef | null>(LAST_KEY, null)?.translationId ?? DEFAULT_TRANSLATION
  return hashFor({ translationId, book: meta.books[o.book].id, chapter: o.chapter, verse: o.verse })
}
