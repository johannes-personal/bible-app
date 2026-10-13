import type { Book } from './api'

// Finds Bible references such as "Deuteronomy 8:3", "Psalms 91:11–12", "5 Mos 8:3",
// "Ps 91:11f." or "Matt 5:3; 6:9" in footnote text.

export interface Reference {
  /** Position of the reference in the text. */
  start: number
  end: number
  /** USFM book code, e.g. "DEU". */
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
}

// Common names and abbreviations per book, in English and Swedish. The current
// translation's own book names are added on top of these.
const NAMES: Record<string, string[]> = {
  GEN: ['Genesis', 'Gen', 'Gn', '1 Mos', '1 Moseboken'],
  EXO: ['Exodus', 'Exod', 'Exo', 'Ex', '2 Mos', '2 Moseboken'],
  LEV: ['Leviticus', 'Lev', 'Lv', '3 Mos', '3 Moseboken'],
  NUM: ['Numbers', 'Num', 'Nm', '4 Mos', '4 Moseboken'],
  DEU: ['Deuteronomy', 'Deut', 'Deu', 'Dt', '5 Mos', '5 Moseboken'],
  JOS: ['Joshua', 'Josh', 'Jos', 'Josua'],
  JDG: ['Judges', 'Judg', 'Jdg', 'Dom', 'Domarboken'],
  RUT: ['Ruth', 'Rut', 'Ru'],
  '1SA': ['1 Samuel', '1 Sam', '1 Sa', '1 Samuelsboken'],
  '2SA': ['2 Samuel', '2 Sam', '2 Sa', '2 Samuelsboken'],
  '1KI': ['1 Kings', '1 Kgs', '1 Ki', '1 Kung', '1 Kungaboken'],
  '2KI': ['2 Kings', '2 Kgs', '2 Ki', '2 Kung', '2 Kungaboken'],
  '1CH': ['1 Chronicles', '1 Chron', '1 Chr', '1 Krön', '1 Krönikeboken'],
  '2CH': ['2 Chronicles', '2 Chron', '2 Chr', '2 Krön', '2 Krönikeboken'],
  EZR: ['Ezra', 'Ezr', 'Esra', 'Esr'],
  NEH: ['Nehemiah', 'Neh', 'Nehemja'],
  EST: ['Esther', 'Esth', 'Est', 'Ester'],
  JOB: ['Job', 'Jb', 'Jobs bok'],
  PSA: ['Psalms', 'Psalm', 'Pss', 'Psa', 'Ps', 'Psaltaren'],
  PRO: ['Proverbs', 'Prov', 'Pro', 'Prv', 'Ordspr', 'Ordspråksboken'],
  ECC: ['Ecclesiastes', 'Eccles', 'Eccl', 'Ecc', 'Qoh', 'Pred', 'Predikaren'],
  SNG: ['Song of Songs', 'Song of Solomon', 'Song', 'Sg', 'Höga visan', 'Höga v', 'Högav'],
  ISA: ['Isaiah', 'Isa', 'Jes', 'Jesaja'],
  JER: ['Jeremiah', 'Jer', 'Jeremia'],
  LAM: ['Lamentations', 'Lam', 'Klag', 'Klagovisorna'],
  EZK: ['Ezekiel', 'Ezek', 'Ezk', 'Eze', 'Hes', 'Hesekiel'],
  DAN: ['Daniel', 'Dan', 'Dn'],
  HOS: ['Hosea', 'Hos'],
  JOL: ['Joel', 'Jl'],
  AMO: ['Amos'],
  OBA: ['Obadiah', 'Obad', 'Ob', 'Obadja'],
  JON: ['Jonah', 'Jon', 'Jona'],
  MIC: ['Micah', 'Mic', 'Mi', 'Mika', 'Mik'],
  NAM: ['Nahum', 'Nah', 'Na'],
  HAB: ['Habakkuk', 'Hab', 'Habackuk'],
  ZEP: ['Zephaniah', 'Zeph', 'Zep', 'Sef', 'Sefanja'],
  HAG: ['Haggai', 'Hag', 'Hagg', 'Haggaj'],
  ZEC: ['Zechariah', 'Zech', 'Zec', 'Sak', 'Sakarja'],
  MAL: ['Malachi', 'Mal', 'Malaki'],
  MAT: ['Matthew', 'Matt', 'Mat', 'Mt', 'Matteus', 'Matteusevangeliet'],
  MRK: ['Mark', 'Mrk', 'Mk', 'Markus', 'Markusevangeliet'],
  LUK: ['Luke', 'Luk', 'Lk', 'Lukas', 'Lukasevangeliet'],
  JHN: ['John', 'Jhn', 'Jn', 'Joh', 'Johannes', 'Johannesevangeliet'],
  ACT: ['Acts', 'Act', 'Apg', 'Apostlagärningarna'],
  ROM: ['Romans', 'Rom', 'Rm', 'Romarbrevet'],
  '1CO': ['1 Corinthians', '1 Cor', '1 Co', '1 Kor', '1 Korinthierbrevet', '1 Korintierbrevet'],
  '2CO': ['2 Corinthians', '2 Cor', '2 Co', '2 Kor', '2 Korinthierbrevet', '2 Korintierbrevet'],
  GAL: ['Galatians', 'Gal', 'Galaterbrevet'],
  EPH: ['Ephesians', 'Eph', 'Ef', 'Efesierbrevet'],
  PHP: ['Philippians', 'Phil', 'Php', 'Fil', 'Filipperbrevet'],
  COL: ['Colossians', 'Col', 'Kol', 'Kolosserbrevet'],
  '1TH': ['1 Thessalonians', '1 Thess', '1 Th', '1 Tess', '1 Tessalonikerbrevet'],
  '2TH': ['2 Thessalonians', '2 Thess', '2 Th', '2 Tess', '2 Tessalonikerbrevet'],
  '1TI': ['1 Timothy', '1 Tim', '1 Ti', '1 Timoteusbrevet'],
  '2TI': ['2 Timothy', '2 Tim', '2 Ti', '2 Timoteusbrevet'],
  TIT: ['Titus', 'Tit', 'Titusbrevet'],
  PHM: ['Philemon', 'Philem', 'Phlm', 'Filem', 'Filemonbrevet'],
  HEB: ['Hebrews', 'Heb', 'Hebr', 'Hebreerbrevet'],
  JAS: ['James', 'Jas', 'Jak', 'Jakobsbrevet'],
  '1PE': ['1 Peter', '1 Pet', '1 Pe', '1 Petr', '1 Petrusbrevet'],
  '2PE': ['2 Peter', '2 Pet', '2 Pe', '2 Petr', '2 Petrusbrevet'],
  '1JN': ['1 John', '1 Jn', '1 Joh', '1 Johannesbrevet'],
  '2JN': ['2 John', '2 Jn', '2 Joh', '2 Johannesbrevet'],
  '3JN': ['3 John', '3 Jn', '3 Joh', '3 Johannesbrevet'],
  JUD: ['Jude', 'Jud', 'Judas', 'Judasbrevet'],
  REV: ['Revelation', 'Rev', 'Rv', 'Upp', 'Uppenbarelseboken'],
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** "1 Sam" also matches "1Sam" and "1 Sam."; any spaces may vary. */
const namePattern = (name: string) => escape(name.trim()).replace(/\\?\s+/g, '\\s*')

export interface ReferenceFinder {
  /** `currentBook` resolves references like "(see 12:25)" that leave out the book. */
  find(text: string, currentBook?: string): Reference[]
}

// Words after which a bare "12:25" points into the current book.
const SAME_BOOK = /(\(|(?<!\p{L})(see|se|cf|jfr|compare|also in|även i)\.?)\s*$/iu

/** Builds a finder that knows the built-in names plus the given translation's book names. */
export function referenceFinder(books: Book[] = []): ReferenceFinder {
  // Keys ignore case, spaces and a trailing dot, so "1Kor", "1 Kor" and "1 kor." are one name.
  const keyOf = (name: string) => name.toLowerCase().replace(/\s+/g, '').replace(/\.$/, '')
  const byName = new Map<string, { id: string; name: string }>()
  const add = (name: string | undefined, id: string) => {
    const key = name && keyOf(name)
    if (key && !byName.has(key)) byName.set(key, { id, name: name.trim() })
  }
  // The translation's own names win over the built-in table.
  for (const b of books) {
    add(b.name, b.id)
    add(b.commonName, b.id)
  }
  for (const [id, names] of Object.entries(NAMES)) for (const n of names) add(n, id)

  const names = [...byName.values()].map((v) => v.name).sort((a, b) => b.length - a.length)
  const book = `(${names.map(namePattern).join('|')})\\.?`
  // "11–12", or "11f." / "11ff." (and the following verse(s)) right after the number.
  const verses = '(\\d{1,3})\\s*:\\s*(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3})|(ff?)(?!\\p{L})\\.?)?'
  // A book name and chapter:verse, or a bare chapter:verse that continues a list ("; 6:9").
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${book}\\s*)?${verses}`, 'giu')

  const lookup = (name: string) => byName.get(keyOf(name))?.id

  return {
    find(text, currentBook) {
      const refs: Reference[] = []
      let lastBook: string | undefined
      let lastEnd = 0
      for (const m of text.matchAll(pattern)) {
        const [whole, name, chapter, verse, to, following] = m
        const start = m.index ?? 0
        let id: string | undefined
        if (name) id = lookup(name)
        else if (lastBook && /^\s*[;,]\s*$|^\s*(and|och|&)\s*$/i.test(text.slice(lastEnd, start))) id = lastBook
        else if (currentBook && SAME_BOOK.test(text.slice(lastEnd, start))) id = currentBook
        if (!id) continue
        const verseStart = Number(verse)
        const verseEnd = to ? Number(to) : following ? verseStart + following.length : verseStart
        refs.push({
          start,
          end: start + whole.replace(/\s+$/, '').length,
          book: id,
          chapter: Number(chapter),
          verseStart,
          verseEnd: Math.max(verseEnd, verseStart),
        })
        lastBook = id
        lastEnd = start + whole.length
      }
      return refs
    },
  }
}

/** "Psalms 91:11–12" style label, using the translation's book name when known. */
export function referenceLabel(ref: Reference, books: Book[] = []): string {
  const name = books.find((b) => b.id === ref.book)?.name ?? NAMES[ref.book]?.[0] ?? ref.book
  const verses = ref.verseEnd > ref.verseStart ? `${ref.verseStart}–${ref.verseEnd}` : `${ref.verseStart}`
  return `${name} ${ref.chapter}:${verses}`
}
