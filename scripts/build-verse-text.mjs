// Builds public/word-study/text.txt: the Berean Standard Bible's text, one verse per line as
// "<verse code>\t<text>", for searching verses by phrase in word study. Verse codes are the
// word index's (book index in meta.json × 1,000,000 + chapter × 1,000 + verse).
//
//   node scripts/build-verse-text.mjs
//
// The BSB is public domain. Its complete text (about 8 MB) is cached in .cache/word-study.

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, '.cache/word-study/bsb-complete.json')
const OUT = path.join(ROOT, 'public/word-study/text.txt')

if (!fs.existsSync(CACHE)) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true })
  const res = await fetch('https://bible.helloao.org/api/BSB/complete.json')
  if (!res.ok) throw new Error(`BSB download failed: ${res.status}`)
  fs.writeFileSync(CACHE, await res.text())
}

const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/word-study/meta.json'), 'utf8'))
const bookIndex = new Map(meta.books.map((b, i) => [b.id, i]))
const bsb = JSON.parse(fs.readFileSync(CACHE, 'utf8'))

// Text parts joined the way the reader joins them (no space before closing punctuation).
const CLOSING = /^[\s”’"'»),.;:!?\]]/
const OPENING = /[\s“‘«„([]$/
const plain = (content) => {
  let out = ''
  for (const c of content) {
    const text = typeof c === 'string' ? c : c && typeof c.text === 'string' ? c.text : null
    if (text == null) continue
    if (out && !OPENING.test(out) && !CLOSING.test(text)) out += ' '
    out += text
  }
  return out.replace(/\s+/g, ' ').trim()
}

const lines = []
for (const book of bsb.books) {
  const b = bookIndex.get(book.id)
  if (b == null) throw new Error(`Unknown book ${book.id}`)
  for (const { chapter } of book.chapters) {
    for (const item of chapter.content) {
      if (item.type !== 'verse') continue
      const text = plain(item.content)
      if (text) lines.push(`${b * 1e6 + chapter.number * 1e3 + item.number}\t${text}`)
    }
  }
}
fs.writeFileSync(OUT, lines.join('\n') + '\n')
console.log(`${lines.length} verses, ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB → ${path.relative(ROOT, OUT)}`)
