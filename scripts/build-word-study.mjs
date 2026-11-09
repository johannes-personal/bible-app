// Builds the word study index in public/word-study/ from:
// - the Berean Standard Bible interlinear (public domain), via the Free Use Bible API: every
//   Hebrew, Aramaic and Greek word with its Strong's number and the BSB English for it;
// - the STEPBible brief lexicons TBESH and TBESG (Tyndale House, CC BY 4.0) for lemmas,
//   transliterations, parts of speech and definitions;
// - Strong's dictionaries (public domain; XML editions via Open Scriptures) for pronunciation,
//   roots, Strong's definitions and KJV renderings.
//
//   node scripts/build-word-study.mjs [--cache DIR]
//
// Downloads are cached in DIR (default .cache/word-study), so a rebuild is quick. The output
// is committed; rerun this only to pick up new source data or a changed format.
//
// Output (all JSON):
//   meta.json      books (name, section, original-language words per chapter) and sections
//   names.json     Strong's number -> [lemma, transliteration, gloss, occurrences, language]
//   s/G00.json…    per 100 Strong's numbers: English renderings, every occurrence and the words
//                  most often found in the same verses
//   l/G00.json…    the same numbers' lexicon entries: part of speech, pronunciation, root,
//                  Strong's definition, KJV renderings, and the STEPBible senses
//   e/a.json…      per first letter: English word -> its forms, and the Strong's numbers (and which
//                  of their renderings) it translates

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const OUT = path.join(ROOT, 'public/word-study')
const args = process.argv.slice(2)
const CACHE = path.resolve(args[args.indexOf('--cache') + 1] && args.includes('--cache') ? args[args.indexOf('--cache') + 1] : path.join(ROOT, '.cache/word-study'))

const API = 'https://bible.helloao.org/api'
const STEP = 'https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Lexicons/'
const STRONGS = 'https://raw.githubusercontent.com/openscriptures/strongs/master/'
const LEXICONS = [
  'TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt',
  'TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt',
]

// ---------------------------------------------------------------------------------------------
// Downloading

async function cached(name, url) {
  const file = path.join(CACHE, name)
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8')
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} for ${url}`)
      const text = await res.text()
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, text)
      return text
    } catch (e) {
      if (attempt >= 3) throw e
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
}

async function inParallel(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await fn(items[i])
      }
    }),
  )
  return results
}

// ---------------------------------------------------------------------------------------------
// Books and sections

const SECTIONS = [
  ['Law', 'GEN', 'DEU'],
  ['History', 'JOS', 'EST'],
  ['Wisdom and poetry', 'JOB', 'SNG'],
  ['Major prophets', 'ISA', 'DAN'],
  ['Minor prophets', 'HOS', 'MAL'],
  ['Gospels', 'MAT', 'JHN'],
  ['Acts', 'ACT', 'ACT'],
  ["Paul's letters", 'ROM', 'PHM'],
  ['Other letters', 'HEB', 'JUD'],
  ['Revelation', 'REV', 'REV'],
]

// ---------------------------------------------------------------------------------------------
// English renderings

// Words around a rendering that come from grammar (articles, prepositions, pronoun suffixes)
// rather than from the word's meaning: "of the LORD" and "the LORD" are both renderings of "LORD".
const LEADING = new Set(
  ('the a an of and to in into for from on with by at as that his her their my your our its this these those ' +
    'according is are was were be been will shall would should have has had i you he she we they it who').split(' '),
)
const TRAILING = new Set('me you him her it us them his its is are was'.split(' '))

/** The core of a BSB rendering, or null for words without an English rendering of their own. */
export function renderingOf(gloss) {
  if (!gloss) return null
  let words = gloss
    .replace(/[[\]{}()“”"‘’]/g, ' ')
    .replace(/[,.;:!?—–]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length || words.every((w) => /^[.-]+$/.test(w))) return null
  while (words.length > 1 && LEADING.has(words[0].toLowerCase())) words = words.slice(1)
  while (words.length > 1 && TRAILING.has(words[words.length - 1].toLowerCase())) words = words.slice(0, -1)
  return words.join(' ')
}

// English words left out of the search index: they're grammar, not meaning.
const STOPWORDS = new Set(
  (
    'a an the of and or but nor to in into on onto at by for from with without as than then so that this these those ' +
    'is am are was were be been being have has had do does did shall will would should can could may might must ' +
    'i me my mine we us our ours you your yours he him his she her hers it its they them their theirs ' +
    'who whom whose which what not no'
  ).split(' '),
)

export const tokensOf = (rendering) =>
  rendering
    .toLowerCase()
    .split(/[^\p{L}']+/u)
    .map((t) => t.replace(/^'+|'+$/g, '').replace(/'s$/, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))

/**
 * Groups word forms under a base form that also occurs in the text: "loved", "loves" and
 * "loving" under "love", "mercies" under "mercy", "sinned" under "sin". Only suffixes are
 * removed, so the base always starts with the same letter.
 */
export function lemmatizer(vocabulary) {
  const has = (w) => vocabulary.has(w)
  return (w) => {
    const candidates = []
    if (w.endsWith('ies')) candidates.push(w.slice(0, -3) + 'y')
    if (w.endsWith('ied')) candidates.push(w.slice(0, -3) + 'y')
    if (w.endsWith('es')) candidates.push(w.slice(0, -2))
    if (w.endsWith('s') && !w.endsWith('ss')) candidates.push(w.slice(0, -1))
    for (const suffix of ['ed', 'ing']) {
      if (!w.endsWith(suffix) || w.length < suffix.length + 3) continue
      const stem = w.slice(0, -suffix.length)
      candidates.push(stem, stem + 'e')
      if (stem.length > 2 && stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1))
    }
    if (w.endsWith('d') && w.endsWith('ed')) candidates.push(w.slice(0, -1))
    const base = candidates.find((c) => c.length > 1 && has(c))
    return base ?? w
  }
}

// ---------------------------------------------------------------------------------------------
// Lexicon

const stripHtml = (s) =>
  s
    .replace(/<br\s*\/?>/gi, '; ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s*;\s*(;\s*)+/g, '; ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s;:,]+|[\s;:,]+$/g, '')

const decodeEntities = (s) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '‹')
    .replace(/&gt;/g, '›')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')

// Definitions are stored as plain text with a few markers the app renders (and escapes):
// <b>…</b> and <i>…</i> for emphasis, [[r:MAT.9.37|Mat 9:37]] for a verse reference and
// [[w:H2616]] for another word. Every other tag is dropped.

/** STEPBible references ("Mat.9.37", "1Co.10.17, 33") -> reader markers. */
const markRefs = (s) =>
  s.replace(/<ref='([^']*)'>([^<]*)<\/ref>/gi, (_, target, text) => {
    const m = /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)/.exec(target.trim())
    const shown = text.replace(/[;,\s]+$/, '').replace(/^([1-3]?[A-Za-z]{2,3})\./, '$1 ')
    const trailing = /;\s*$/.test(text) ? ';' : ''
    return m ? `[[r:${m[1].toUpperCase()}.${m[2]}.${m[3]}|${shown}]]${trailing}` : shown + trailing
  })

const tidy = (s) =>
  decodeEntities(
    markRefs(s)
      .replace(/<(\/?)(b|i)\b[^>]*>/gi, '\uE000$1$2\uE001') // keep <b> and <i>
      .replace(/<[^>]+>/g, '')
      .replace(/\uE000(\/?)(b|i)\uE001/g, '<$1$2>'),
  )
    .replace(/__/g, '')
    .replace(/<(b|i)>\s*<\/\1>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;.:)])/g, '$1')
    .trim()

/**
 * The senses of a STEPBible definition as [depth, label, text]. Hebrew entries are outlines
 * ("1)", "1a)", "1a1)"); Greek entries (Abbott-Smith) number senses "__I.", "__1.", "__(a)",
 * open with the headword and its endings ("ἀγάπη, -ης, ἡ"), and note the Septuagint in brackets.
 */
export function parseSenses(html, lemma) {
  const senses = []
  const notes = []
  let forms = ''
  const pieces = html
    .split(/<br\s*\/?>/i)
    .map((p) => p.trim())
    .filter(Boolean)
  pieces.forEach((raw, i) => {
    if (i === 0 && /^:/.test(raw)) return // the meaning this extended number stands for
    const piece = raw.replace(/\[[^[\]]*\]/g, '') // notes in brackets, mostly on the Septuagint
    const plain = tidy(piece)
    if (!plain || /^[;,.\s]*$/.test(plain)) return
    if (i === 0 && lemma && piece.includes(`<b>${lemma}</b>`)) {
      forms = plain.replace(/<\/?[bi]>/g, '').replace(/[,;]\s*$/, '')
      return
    }
    if (/^Also means:/i.test(plain)) return notes.push(plain)
    const hebrew = /^(\d+[a-z]?(?:\d+[a-z]?)*)\)\s*/.exec(plain)
    const greek = /^(?:<b>)?\s*([IVX]+|\d+|\([a-z]\)|\([ivx]+\))\.?\s*(?:<\/b>)?\s+/.exec(plain)
    if (hebrew) {
      const label = hebrew[1]
      const depth = label.match(/\d+|[a-z]/g).length - 1
      senses.push([depth, label, plain.slice(hebrew[0].length).trim()])
    } else if (greek && /^__/.test(piece.trim())) {
      const label = greek[1]
      const depth = /^[IVX]+$/.test(label) ? 0 : /^\d+$/.test(label) ? 1 : /^\([a-z]\)$/.test(label) ? 2 : 3
      senses.push([depth, label, plain.slice(greek[0].length).trim()])
    } else if (senses.length) {
      senses[senses.length - 1][2] += ' ' + plain
    } else {
      senses.push([0, '', plain.replace(/^[;:,\s]+/, '').trim()])
    }
  })
  // Depths relative to the shallowest, so an entry without roman numerals starts at 0.
  const min = Math.min(...senses.map((s) => s[0]))
  for (const s of senses) s[0] -= min
  return { forms, senses: senses.filter((s) => s[2] || s[1]), notes }
}

/** "G:N-F" -> "Noun, feminine"; "N:N-M-P" -> "Name of a man". */
export function partOfSpeech(code) {
  // "G:A / G:ADV" -> "Adjective or adverb"
  if (code.includes('/') && code.includes(' / ')) {
    const parts = [...new Set(code.split(' / ').map((c) => partOfSpeech(c.trim())).filter(Boolean))]
    return parts.map((p, i) => (i ? p.toLowerCase() : p)).join(' or ')
  }
  const [lang, rest = ''] = code.split(':')
  const [kind, gender = '', what = ''] = rest.split('-')
  const genders = { M: 'masculine', F: 'feminine', N: 'neuter', 'M/F': 'masculine or feminine' }
  if (lang === 'N') {
    if (what.startsWith('P')) return gender === 'F' ? 'Name of a woman' : gender === 'M' ? 'Name of a man' : 'Name of a people'
    if (what.startsWith('L')) return 'Name of a place'
    if (what.startsWith('T')) return 'Name or title'
    return 'Proper name'
  }
  const kinds = {
    N: 'Noun', V: 'Verb', A: 'Adjective', ADV: 'Adverb', Adv: 'Adverb', PREP: 'Preposition', Prep: 'Preposition',
    CONJ: 'Conjunction', Conj: 'Conjunction', PRT: 'Particle', COND: 'Conditional particle', INJ: 'Interjection',
    Intj: 'Interjection', D: 'Article', P: 'Pronoun', DemP: 'Demonstrative pronoun', Intg: 'Interrogative',
  }
  const name = kinds[kind] ?? ''
  if (kind === 'A' && gender === 'NUI') return 'Number'
  return name && genders[gender] ? `${name}, ${genders[gender]}` : name
}

/** The first entry per plain Strong's number ("H2617" for "H2617a" and "H2617b"). */
function parseLexicon(text) {
  const entries = new Map()
  for (const line of text.split('\n')) {
    const cols = line.split('\t')
    const m = /^([GH])(\d{4})[a-zA-Z]?$/.exec(cols[0] ?? '')
    if (!m || cols.length < 8) continue
    const strongs = m[1] + m[2]
    if (entries.has(strongs)) continue
    const lemma = cols[3].trim()
    entries.set(strongs, {
      lemma,
      translit: cols[4].trim().replace(/\./g, ''),
      // "to speak: speak" -> "to speak"
      gloss: stripHtml(cols[6]).split(':')[0].trim(),
      pos: partOfSpeech(cols[5].trim()),
      ...parseSenses(cols[7], lemma),
    })
  }
  return entries
}

/** Strong's own dictionary (public domain): pronunciation, root, definition and KJV renderings. */
function parseStrongsGreek(xml) {
  const entries = new Map()
  for (const m of xml.matchAll(/<entry strongs="(\d+)">([\s\S]*?)<\/entry>/g)) {
    const body = m[2]
    const field = (tag) => new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(body)?.[1] ?? ''
    const words = (s) =>
      s
        .replace(/<strongsref language="GREEK" strongs="(\d+)"\/>/g, (_, n) => `[[w:G${String(Number(n)).padStart(4, '0')}]]`)
        .replace(/<strongsref language="HEBREW" strongs="(\d+)"\/>/g, (_, n) => `[[w:H${String(Number(n)).padStart(4, '0')}]]`)
        .replace(/<greek [^>]*unicode="([^"]*)"[^>]*\/>/g, '$1')
    entries.set(`G${m[1].slice(-4)}`, {
      pron: /<pronunciation strongs="([^"]*)"/.exec(body)?.[1] ?? '',
      root: tidy(words(field('strongs_derivation'))).replace(/[;,.]\s*$/, ''),
      definition: tidy(field('strongs_def')),
      kjv: tidy(field('kjv_def').replace(/^:--/, '')).replace(/\.?\s*Compare,?$/, '').replace(/\.$/, ''),
    })
  }
  return entries
}

function parseStrongsHebrew(xml) {
  const entries = new Map()
  for (const m of xml.matchAll(/<div type="entry" n="(\d+)">([\s\S]*?)<\/div>/g)) {
    const body = m[2]
    const note = (type) => new RegExp(`<note type="${type}">([\\s\\S]*?)</note>`).exec(body)?.[1] ?? ''
    const words = (s) =>
      s
        .replace(/<w [^>]*src="(\d+)"[^>]*\/>/g, (_, n) => `[[w:H${String(Number(n)).padStart(4, '0')}]]`)
        .replace(/<w [^>]*lemma="([^"]*)"[^>]*\/>/g, '$1') // a form without its own number
    entries.set(`H${m[1].padStart(4, '0')}`, {
      pron: /<w [^>]*POS="([^"]*)"/.exec(body)?.[1] ?? '',
      root: tidy(words(note('exegesis'))).replace(/[;,.]\s*$/, ''),
      definition: tidy(note('explanation').replace(/<\/?hi>/g, '')),
      kjv: tidy(words(note('translation'))).replace(/\.$/, ''), // may end "Compare [[w:H3050]]"
    })
  }
  return entries
}

// ---------------------------------------------------------------------------------------------
// Co-occurrence

// Verbs too common to say anything about the words around them ("to be", "to say").
const TOO_COMMON = new Set(['H1961', 'H0559', 'G1510', 'G3004', 'G2036', 'G5346', 'G1096'])
/**
 * Words that carry meaning: nouns, verbs and adjectives (not particles, pronouns or prepositions).
 * Hebrew codes list attached prefixes first ("Conj-w, Prep-l | V-Hifil-Inf"); the word itself is last.
 */
const isContent = (strongs, parsing) =>
  !TOO_COMMON.has(strongs) && /^(N|V|Adj)\b/.test((parsing ?? '').split('|').pop().trim())

/** Log-likelihood ratio (G²) of two words appearing in the same verses more often than by chance. */
function logLikelihood(both, a, b, total) {
  const k = [both, a - both, b - both, total - a - b + both]
  const rows = [a, total - a]
  const cols = [b, total - b]
  let g = 0
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      const observed = k[i * 2 + j]
      const expected = (rows[i] * cols[j]) / total
      if (observed > 0) g += observed * Math.log(observed / expected)
    }
  return 2 * g
}

const RELATED = 15

// ---------------------------------------------------------------------------------------------

async function main() {
  console.log(`Cache: ${CACHE}`)
  const books = JSON.parse(await cached('books.json', `${API}/d/bsb-interlinear/books.json`)).books
  const bsbBooks = JSON.parse(await cached('bsb-books.json', `${API}/BSB/books.json`)).books
  const names = new Map(bsbBooks.map((b) => [b.id, b.commonName || b.name]))

  const jobs = books.flatMap((b, bookIndex) =>
    Array.from({ length: b.numberOfChapters }, (_, i) => ({ book: b.id, bookIndex, chapter: i + 1 })),
  )
  let done = 0
  const chapters = await inParallel(jobs, 12, async (job) => {
    const text = await cached(`interlinear/${job.book}-${job.chapter}.json`, `${API}/d/bsb-interlinear/${job.book}/${job.chapter}.json`)
    if (++done % 200 === 0) console.log(`  ${done}/${jobs.length} chapters`)
    return { ...job, content: JSON.parse(text).chapter.content }
  })

  const lexicon = new Map()
  for (const file of LEXICONS) {
    for (const [k, v] of parseLexicon(await cached(file, STEP + encodeURIComponent(file)))) lexicon.set(k, v)
  }
  const strongsDictionary = new Map([
    ...parseStrongsGreek(await cached('strongsgreek.xml', `${STRONGS}greek/StrongsGreekDictionaryXML_1.4/strongsgreek.xml`)),
    ...parseStrongsHebrew(await cached('StrongHebrewG.xml', `${STRONGS}hebrew/StrongHebrewG.xml`)),
  ])

  // Per Strong's number: occurrences, renderings and language.
  const words = new Map()
  const wordOf = (strongs, language) => {
    let w = words.get(strongs)
    if (!w) {
      w = { language, occurrences: [], renderings: new Map(), verses: new Set(), forms: new Map() }
      words.set(strongs, w)
    }
    return w
  }
  const chapterWords = books.map((b) => new Array(b.numberOfChapters).fill(0))
  const verseSets = [] // content words per verse, for co-occurrence
  for (const ch of chapters) {
    for (const verse of ch.content) {
      const code = ch.bookIndex * 1_000_000 + ch.chapter * 1000 + verse.verse
      const content = new Set()
      for (const word of verse.words) {
        chapterWords[ch.bookIndex][ch.chapter - 1]++
        const strongs = word.strongs
        if (!/^[GH]\d{4}$/.test(strongs ?? '')) continue
        const w = wordOf(strongs, word.language)
        const rendering = renderingOf(word.gloss)
        let r = -1
        if (rendering) {
          const key = rendering.toLowerCase()
          let entry = w.renderings.get(key)
          if (!entry) {
            entry = { index: w.renderings.size, count: 0, spellings: new Map() }
            w.renderings.set(key, entry)
          }
          entry.count++
          entry.spellings.set(rendering, (entry.spellings.get(rendering) ?? 0) + 1)
          r = entry.index
        }
        w.occurrences.push(code, r)
        w.verses.add(code)
        if (word.transliteration) w.forms.set(word.transliteration, (w.forms.get(word.transliteration) ?? 0) + 1)
        if (isContent(strongs, word.parsing)) content.add(strongs)
      }
      if (content.size > 1) verseSets.push([...content])
    }
  }
  console.log(`${words.size} Strong's numbers`)

  // Co-occurrence by verse.
  const verseCount = new Map()
  const pairs = new Map()
  for (const set of verseSets) for (const s of set) verseCount.set(s, (verseCount.get(s) ?? 0) + 1)
  for (const [s, w] of words) if (!verseCount.has(s)) verseCount.set(s, w.verses.size)
  const totalVerses = chapters.reduce((n, ch) => n + ch.content.length, 0)
  for (const set of verseSets) {
    set.sort()
    for (let i = 0; i < set.length; i++)
      for (let j = i + 1; j < set.length; j++) {
        const key = `${set[i]} ${set[j]}`
        pairs.set(key, (pairs.get(key) ?? 0) + 1)
      }
  }
  const related = new Map()
  for (const [key, both] of pairs) {
    if (both < 3) continue // two shared verses is too easily chance
    const [a, b] = key.split(' ')
    const na = verseCount.get(a)
    const nb = verseCount.get(b)
    if (both <= (na * nb) / totalVerses) continue // no more often than by chance
    const score = logLikelihood(both, na, nb, totalVerses)
    for (const [x, y] of [[a, b], [b, a]]) {
      let list = related.get(x)
      if (!list) related.set(x, (list = []))
      list.push([y, both, Math.round(score * 10) / 10])
    }
  }
  for (const list of related.values()) {
    list.sort((p, q) => q[2] - p[2])
    list.length = Math.min(list.length, RELATED)
  }

  // Display spelling of each rendering: its most common one ("LORD", "Israel", "love").
  const renderingList = (w) =>
    [...w.renderings.values()]
      .sort((a, b) => a.index - b.index)
      .map((e) => [[...e.spellings].sort((a, b) => b[1] - a[1])[0][0], e.count])

  // English index: word -> Strong's numbers whose renderings contain it.
  const vocabulary = new Map()
  for (const w of words.values())
    for (const [rendering, count] of renderingList(w))
      for (const t of tokensOf(rendering)) vocabulary.set(t, (vocabulary.get(t) ?? 0) + count)
  const lemmaOf = lemmatizer(new Set(vocabulary.keys()))
  const english = new Map()
  for (const [strongs, w] of words) {
    renderingList(w).forEach(([rendering, count], r) => {
      for (const token of new Set(tokensOf(rendering))) {
        const lemma = lemmaOf(token)
        let e = english.get(lemma)
        if (!e) english.set(lemma, (e = { forms: new Map(), strongs: new Map(), total: 0 }))
        e.forms.set(token, (e.forms.get(token) ?? 0) + count)
        let s = e.strongs.get(strongs)
        if (!s) e.strongs.set(strongs, (s = { count: 0, renderings: [] }))
        s.count += count
        if (!s.renderings.includes(r)) s.renderings.push(r)
        e.total += count
      }
    })
  }

  // ---------------------------------------------------------------------------------------------
  // Write

  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(path.join(OUT, 's'), { recursive: true })
  fs.mkdirSync(path.join(OUT, 'e'), { recursive: true })
  fs.mkdirSync(path.join(OUT, 'l'), { recursive: true })
  const write = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data))

  const sectionOf = (bookIndex) => {
    const id = books[bookIndex].id
    const order = books.map((b) => b.id)
    return SECTIONS.findIndex(([, from, to]) => order.indexOf(id) >= order.indexOf(from) && order.indexOf(id) <= order.indexOf(to))
  }
  write('meta.json', {
    source: 'Berean Standard Bible interlinear (public domain); STEPBible brief lexicons (CC BY 4.0)',
    totalVerses,
    sections: SECTIONS.map(([name]) => name),
    books: books.map((b, i) => ({ id: b.id, name: names.get(b.id) ?? b.id, section: sectionOf(i), words: chapterWords[i] })),
  })

  const lang = { hebrew: 'h', aramaic: 'a', greek: 'g' }
  const commonForm = (w) => [...w.forms].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  const nameList = {}
  for (const [strongs, w] of [...words].sort()) {
    const lex = lexicon.get(strongs)
    nameList[strongs] = [lex?.lemma ?? '', lex?.translit || commonForm(w), lex?.gloss ?? '', w.occurrences.length / 2, lang[w.language] ?? 'h']
  }
  write('names.json', nameList)

  const buckets = new Map()
  const lexBuckets = new Map()
  for (const [strongs, w] of words) {
    const bucket = strongs.slice(0, 3)
    if (!buckets.has(bucket)) buckets.set(bucket, {})
    buckets.get(bucket)[strongs] = {
      renderings: renderingList(w),
      occurrences: w.occurrences,
      related: related.get(strongs) ?? [],
    }
    // The lexicon entry, in its own files: only a word's own page needs it.
    const lex = lexicon.get(strongs)
    const dict = strongsDictionary.get(strongs)
    if (!lexBuckets.has(bucket)) lexBuckets.set(bucket, {})
    lexBuckets.get(bucket)[strongs] = {
      partOfSpeech: lex?.pos ?? '',
      pronunciation: dict?.pron ?? '',
      forms: lex?.forms ?? '',
      root: dict?.root ?? '',
      strongs: dict?.definition ?? '',
      kjv: dict?.kjv ?? '',
      senses: lex?.senses ?? [],
      notes: lex?.notes ?? [],
    }
  }
  for (const [bucket, data] of buckets) write(`s/${bucket}.json`, data)
  for (const [bucket, data] of lexBuckets) write(`l/${bucket}.json`, data)

  const letters = new Map()
  for (const [lemma, e] of english) {
    const letter = /^[a-z]/.test(lemma) ? lemma[0] : '_'
    if (!letters.has(letter)) letters.set(letter, {})
    letters.get(letter)[lemma] = {
      total: e.total,
      forms: Object.fromEntries([...e.forms].sort((a, b) => b[1] - a[1])),
      // [Strong's number, occurrences, indexes of its renderings that contain the word]
      strongs: [...e.strongs].sort((a, b) => b[1].count - a[1].count).map(([s, x]) => [s, x.count, x.renderings]),
    }
  }
  for (const [letter, data] of letters) write(`e/${letter}.json`, data)

  let bytes = 0
  for (const dir of ['', 's', 'e', 'l'])
    for (const f of fs.readdirSync(path.join(OUT, dir))) {
      const p = path.join(OUT, dir, f)
      if (fs.statSync(p).isFile()) bytes += fs.statSync(p).size
    }
  console.log(`Wrote ${OUT}: ${buckets.size} word files, ${letters.size} English files, ${(bytes / 1e6).toFixed(1)} MB`)
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
