import { useState, type ReactNode } from 'react'
import { useAsync } from '../hooks'
import { studyHash } from '../route'
import { loadLexicon, verseHash, type Meta, type NameEntry } from './data'
import { Card } from './ui'

// A word's lexicon entry, laid out like a dictionary page: facts (pronunciation, part of
// speech, root, Strong's definition, KJV renderings) beside the numbered senses.

const SENSES_SHOWN = 6

const blueLetterBible = (strongs: string) => {
  const n = Number(strongs.slice(1))
  return strongs[0] === 'H'
    ? `https://www.blueletterbible.org/lexicon/h${n}/kjv/wlc/0-1/`
    : `https://www.blueletterbible.org/lexicon/g${n}/kjv/tr/0-1/`
}

const TOKEN = /<(b|i)>(.*?)<\/\1>|\[\[r:([A-Z0-9]{3})\.(\d+)\.(\d+)\|([^\]]*)\]\]|\[\[w:([GH]\d{4})\]\]/g

/**
 * Renders the lexicon's markup: <b> and <i>, [[r:…]] verse references (links to the reader)
 * and [[w:…]] words (links to their study pages). Everything else is plain text.
 */
export function Markup({ text, meta, names }: { text: string; meta: Meta; names: Record<string, NameEntry> }) {
  const out: ReactNode[] = []
  let at = 0
  for (const m of text.matchAll(TOKEN)) {
    out.push(text.slice(at, m.index))
    const key = m.index
    if (m[1]) {
      const inner = <Markup text={m[2]} meta={meta} names={names} />
      out.push(m[1] === 'b' ? <strong key={key}>{inner}</strong> : <em key={key}>{inner}</em>)
    } else if (m[3]) {
      const book = meta.books.findIndex((b) => b.id === m[3])
      out.push(
        book >= 0 ? (
          <a key={key} className="ws-ref-link" href={verseHash(meta, { book, chapter: Number(m[4]), verse: Number(m[5]) })}>
            {m[6]}
          </a>
        ) : (
          m[6]
        ),
      )
    } else if (m[7]) {
      const name = names[m[7]]
      out.push(
        <a key={key} href={studyHash({ kind: 'word', strongs: m[7] })}>
          {name ? (
            <>
              <span className="ws-lemma" lang={name[4] === 'g' ? 'grc' : 'he'}>{name[0]}</span> {name[1]}
            </>
          ) : (
            m[7]
          )}
        </a>,
      )
    }
    at = (m.index ?? 0) + m[0].length
  }
  out.push(text.slice(at))
  return <>{out}</>
}

export function LexiconCard({ strongs, meta, names }: { strongs: string; meta: Meta; names: Record<string, NameEntry> }) {
  const { data: entry } = useAsync(`lexicon-${strongs}`, () => loadLexicon(strongs))
  const [all, setAll] = useState(false)
  if (!entry) return null
  const lang = names[strongs]?.[4]
  const facts: [string, ReactNode][] = []
  if (entry.pronunciation) facts.push(['Pronunciation', entry.pronunciation])
  if (entry.partOfSpeech) facts.push(['Part of speech', entry.partOfSpeech])
  if (entry.forms) facts.push(['Forms', <span key="forms" lang="grc">{entry.forms}</span>])
  if (entry.root) facts.push(['Root', <Markup key="root" text={entry.root} meta={meta} names={names} />])
  if (entry.strongs) facts.push(["Strong's definition", <Markup key="strongs" text={entry.strongs} meta={meta} names={names} />])
  if (entry.kjv) facts.push(['In the KJV', <Markup key="kjv" text={entry.kjv} meta={meta} names={names} />])
  const senses = all ? entry.senses : entry.senses.slice(0, SENSES_SHOWN)

  return (
    <Card id="lexicon" title="Lexicon">
      <div className="ws-lex">
        <dl className="ws-lex-facts">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div>
            <dt>More</dt>
            <dd>
              <a href={blueLetterBible(strongs)} target="_blank" rel="noreferrer">Blue Letter Bible</a>
            </dd>
          </div>
        </dl>
        {entry.senses.length > 0 && (
          <div className="ws-lex-senses">
            <h3>Meanings</h3>
            <ol>
              {senses.map(([depth, label, text], i) => (
                <li key={i} style={{ marginLeft: `${depth * 1.25}em` }}>
                  {label && <span className="ws-sense-label">{label}</span>}
                  <span>
                    <Markup text={text} meta={meta} names={names} />
                  </span>
                </li>
              ))}
            </ol>
            {entry.senses.length > SENSES_SHOWN && (
              <button className="link ws-view-toggle" onClick={() => setAll(!all)}>
                {all ? 'Show less' : `Show the full entry (${entry.senses.length - SENSES_SHOWN} more)`}
              </button>
            )}
            {entry.notes.map((n, i) => (
              <p key={i} className="muted ws-note">
                <Markup text={n} meta={meta} names={names} />
              </p>
            ))}
            <p className="muted ws-lex-source">
              From the STEPBible {lang === 'g' ? 'Greek (Abbott-Smith)' : 'Hebrew'} brief lexicon.
            </p>
          </div>
        )}
      </div>
    </Card>
  )
}
