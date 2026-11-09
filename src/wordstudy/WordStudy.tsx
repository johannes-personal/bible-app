import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fetchFreeChapterOnly, type ChapterRef } from '../api'
import { Icon } from '../components/Icon'
import { parseChapter } from '../content'
import { useAsync } from '../hooks'
import { DEFAULT_TRANSLATION, goTo, hashFor, LAST_KEY, normalizeStrongs, studyHash, type StudyRoute } from '../route'
import { useSettings } from '../settings'
import { load as loadStored } from '../storage'
import { BibleMap, BookChart, RankedBars, type Mode, type Series } from './charts'
import {
  fold,
  formatCount,
  LANGUAGE_NAMES,
  loadEnglish,
  loadMeta,
  loadNames,
  loadWord,
  occurrencesOf,
  suggestEnglish,
  suggestOriginal,
  type Meta,
  type NameEntry,
  type Occurrence,
  type WordEntry,
} from './data'
import { highlightText } from './highlight'
import './wordstudy.css'

// Word study: search English words or Hebrew/Greek words, and see where and how they're used.
// Built on the Berean Standard Bible interlinear, where each English word is tied to the
// Hebrew or Greek word it translates.

/** Categorical colours for words stacked in one chart, in fixed order; the rest are "Other". */
const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)']
const OTHER_COLOR = 'var(--series-other)'
const SINGLE_COLOR = 'var(--accent)'

/** Where links to verses open: the translation last read in. */
function readerTranslation(): string {
  return loadStored<ChapterRef | null>(LAST_KEY, null)?.translationId ?? DEFAULT_TRANSLATION
}

const verseHash = (meta: Meta, o: { book: number; chapter: number; verse?: number }) =>
  hashFor({ translationId: readerTranslation(), book: meta.books[o.book].id, chapter: o.chapter, verse: o.verse })

const verseLabel = (meta: Meta, o: { book: number; chapter: number; verse: number }) =>
  `${meta.books[o.book].name} ${o.chapter}:${o.verse}`

/** Occurrences per chapter, by book index. */
function chapterCounts(meta: Meta, occurrences: Occurrence[]) {
  const counts = new Map<number, number[]>()
  for (const o of occurrences) {
    let cs = counts.get(o.book)
    if (!cs) counts.set(o.book, (cs = new Array(meta.books[o.book].words.length).fill(0)))
    cs[o.chapter - 1]++
  }
  return counts
}

const byPosition = (a: Occurrence, b: Occurrence) => a.book - b.book || a.chapter - b.chapter || a.verse - b.verse

export default function WordStudy({ route }: { route: StudyRoute }) {
  useSettings() // applies the theme and text size
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])
  const last = loadStored<ChapterRef | null>(LAST_KEY, null)
  const backHash = last ? hashFor({ translationId: last.translationId, book: last.book, chapter: last.chapter }) : '#/'

  return (
    <div className="ws">
      <header className="app-header">
        <div className="header-inner">
          <a className="icon-button" href={backHash} aria-label="Back to reading">
            <Icon name="back" />
          </a>
          <SearchBox route={route} />
        </div>
      </header>
      <main className="ws-main">
        {route.kind === 'home' && <Home />}
        {route.kind === 'word' && <WordPage key={route.strongs} strongs={route.strongs} />}
        {route.kind === 'english' && <EnglishPage key={route.word} word={route.word} />}
        <footer className="attribution ws-credit">
          Word data from the Berean Standard Bible interlinear (public domain). Definitions from the{' '}
          <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noreferrer">STEPBible</a> brief lexicons
          (Tyndale House, CC BY 4.0).
        </footer>
      </main>
    </div>
  )
}

// -----------------------------------------------------------------------------------------------
// Search

interface Suggestion {
  key: string
  hash: string
  label: ReactNode
  hint: string
}

function SearchBox({ route }: { route: StudyRoute }) {
  const [query, setQuery] = useState(route.kind === 'english' ? route.word : '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const { data: names } = useAsync('ws-names', loadNames)
  const inputRef = useRef<HTMLInputElement>(null)

  // A new page shows its own word in the box (or nothing), with the suggestions closed.
  const routeWord = route.kind === 'english' ? route.word : ''
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setQuery(routeWord)
    setOpen(false)
    if (route.kind === 'home') inputRef.current?.focus()
  }, [route, routeWord])

  useEffect(() => {
    let live = true
    const q = query.trim()
    const timer = setTimeout(async () => {
      // Exact matches first (in either language), then the most used words.
      const ranked: { s: Suggestion; rank: number }[] = []
      const strongs = normalizeStrongs(q)
      if (strongs && names?.[strongs]) ranked.push({ s: originalSuggestion(strongs, names[strongs]), rank: Infinity })
      for (const e of await suggestEnglish(q, 6)) {
        ranked.push({
          s: { key: `en-${e.lemma}`, hash: studyHash({ kind: 'english', word: e.lemma }), label: e.lemma, hint: `English · ${formatCount(e.total)}×` },
          rank: (e.lemma === q.toLowerCase() ? 1e6 : 0) + e.total,
        })
      }
      if (names) {
        for (const s of suggestOriginal(names, q, 6)) {
          if (s === strongs) continue
          const [lemma, translit, , count] = names[s]
          const exact = fold(translit) === fold(q) || fold(lemma) === fold(q)
          ranked.push({ s: originalSuggestion(s, names[s]), rank: (exact ? 1e6 : 0) + count })
        }
      }
      const list = ranked.sort((a, b) => b.rank - a.rank).slice(0, 8).map((r) => r.s)
      if (live) {
        setSuggestions(list)
        setActive(0)
      }
    }, 120)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query, names])

  const go = (hash: string) => {
    setOpen(false)
    inputRef.current?.blur()
    goTo(hash)
  }

  const submit = () => {
    const s = suggestions[active]
    if (open && s) return go(s.hash)
    const q = query.trim()
    const strongs = normalizeStrongs(q)
    if (strongs) return go(studyHash({ kind: 'word', strongs }))
    if (q) go(studyHash({ kind: 'english', word: q.toLowerCase() }))
  }

  return (
    <form
      className="ws-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <Icon name="search" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search a word: love, mercy, chesed, G26…"
        aria-label="Search for a word"
        aria-autocomplete="list"
        aria-expanded={open && suggestions.length > 0}
        aria-controls="ws-suggestions"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, suggestions.length - 1))
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
          else if (e.key === 'Escape') setOpen(false)
          else return
          e.preventDefault()
        }}
      />
      {open && query.trim() && suggestions.length > 0 && (
        <ul className="ws-suggestions" id="ws-suggestions" role="listbox">
          {suggestions.map((s, i) => (
            <li key={s.key} role="option" aria-selected={i === active}>
              <a
                href={s.hash}
                className={i === active ? 'active' : undefined}
                onPointerDown={(e) => {
                  e.preventDefault()
                  go(s.hash)
                }}
              >
                <span>{s.label}</span>
                <span className="muted">{s.hint}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </form>
  )
}

function originalSuggestion(strongs: string, [lemma, translit, gloss, count, lang]: NameEntry): Suggestion {
  return {
    key: strongs,
    hash: studyHash({ kind: 'word', strongs }),
    label: (
      <>
        <span className="ws-lemma" lang={lang === 'g' ? 'grc' : 'he'}>{lemma}</span> {translit}{' '}
        <span className="muted">“{gloss}”</span>
      </>
    ),
    hint: `${LANGUAGE_NAMES[lang]} · ${formatCount(count)}×`,
  }
}

const EXAMPLES: [string, string][] = [
  ['love', studyHash({ kind: 'english', word: 'love' })],
  ['mercy', studyHash({ kind: 'english', word: 'mercy' })],
  ['faith', studyHash({ kind: 'english', word: 'faith' })],
  ['chesed', studyHash({ kind: 'word', strongs: 'H2617' })],
  ['shalom', studyHash({ kind: 'word', strongs: 'H7965' })],
  ['agapē', studyHash({ kind: 'word', strongs: 'G0026' })],
  ['logos', studyHash({ kind: 'word', strongs: 'G3056' })],
]

function Home() {
  return (
    <section className="ws-home">
      <h1>Word study</h1>
      <p>
        Search an English word to see which Hebrew and Greek words it translates, or a Hebrew or Greek word to see
        how it's translated, where in the Bible it's used, and which words it's often found together with.
      </p>
      <p className="muted">
        Based on the Berean Standard Bible, where each English word is linked to the original word it translates.
      </p>
      <div className="ws-examples">
        {EXAMPLES.map(([label, hash]) => (
          <a key={label} className="pill" href={hash}>{label}</a>
        ))}
      </div>
    </section>
  )
}

// -----------------------------------------------------------------------------------------------
// A Hebrew or Greek word

function WordPage({ strongs }: { strongs: string }) {
  const { data, error } = useAsync(`ws-word-${strongs}`, () =>
    Promise.all([loadMeta(), loadNames(), loadWord(strongs)]),
  )
  if (error) return <p className="message">{error.message}</p>
  if (!data) return <Loading />
  const [meta, names, word] = data
  const name = names[strongs]
  if (!word || !name) return <NotFound what={strongs} />
  return <WordDashboard strongs={strongs} meta={meta} names={names} name={name} word={word} />
}

function WordDashboard({ strongs, meta, names, name, word }: {
  strongs: string
  meta: Meta
  names: Record<string, NameEntry>
  name: NameEntry
  word: WordEntry
}) {
  const [lemma, translit, gloss, count, lang] = name
  const [mode, setMode] = useState<Mode>('count')
  const occurrences = useMemo(() => occurrencesOf(strongs, word), [strongs, word])
  const counts = useMemo(() => chapterCounts(meta, occurrences), [meta, occurrences])
  const verses = new Set(occurrences.map((o) => `${o.book}.${o.chapter}.${o.verse}`)).size
  const series: Series[] = [{ key: strongs, label: translit, color: SINGLE_COLOR, chapters: counts }]
  const renderings = word.renderings
    .map(([label, n], i) => ({ key: String(i), label, value: n }))
    .sort((a, b) => b.value - a.value)

  return (
    <article className="ws-page">
      <header className="ws-title">
        <p className="ws-kicker">
          {LANGUAGE_NAMES[lang]} · {strongs}
        </p>
        <h1>
          <span className="ws-lemma big" lang={lang === 'g' ? 'grc' : 'he'}>{lemma}</span> {translit}
        </h1>
        <p className="ws-gloss">{gloss}</p>
        {word.definition && <p className="ws-definition">{word.definition}</p>}
        <a className="link" href={`https://www.stepbible.org/?q=strong=${strongs}`} target="_blank" rel="noreferrer">
          More in STEP Bible
        </a>
      </header>

      <Stats items={[[count, 'times'], [verses, 'verses'], [counts.size, 'books']]} />

      <Section title="Where it's used" actions={<ModeToggle mode={mode} onChange={setMode} />}>
        <BookChart meta={meta} series={series} mode={mode} />
      </Section>

      <Section title="Across the Bible" subtitle="Each row is a book, each square a chapter.">
        <BibleMap meta={meta} counts={counts} onChapter={(b, c) => goTo(verseHash(meta, { book: b, chapter: c }))} />
      </Section>

      <Section title="How it's translated" subtitle="English words the BSB uses for it.">
        <Folded items={renderings} limit={10} render={(items) => <RankedBars items={items} />} />
        {count - renderings.reduce((n, r) => n + r.value, 0) > 0 && (
          <p className="muted ws-note">
            {formatCount(count - renderings.reduce((n, r) => n + r.value, 0))} times without an English word of its own
            (part of a phrase, or grammar such as an article or object marker).
          </p>
        )}
      </Section>

      {word.related.length > 0 && (
        <Section
          title="Found together with"
          subtitle="Words that appear in the same verses more often than chance would explain, strongest first."
        >
          <RankedBars
            unit="verses"
            items={word.related
              .filter(([s]) => names[s])
              .map(([s, shared]) => {
                const [l, t, g, , lg] = names[s]
                return {
                  key: s,
                  href: studyHash({ kind: 'word', strongs: s }),
                  value: shared,
                  label: (
                    <>
                      <span className="ws-lemma" lang={lg === 'g' ? 'grc' : 'he'}>{l}</span> {t}{' '}
                      <span className="muted">{g}</span>
                    </>
                  ),
                }
              })}
          />
        </Section>
      )}

      <Section title="Every occurrence">
        <OccurrenceList
          meta={meta}
          occurrences={occurrences}
          groups={word.renderings.map(([label], i) => ({ key: String(i), label }))}
          groupOf={(o) => String(o.rendering)}
          groupLabel="English"
          highlight={(o) => (o.rendering >= 0 ? [word.renderings[o.rendering][0]] : [])}
        />
      </Section>
    </article>
  )
}

// -----------------------------------------------------------------------------------------------
// An English word

function EnglishPage({ word }: { word: string }) {
  const { data, error } = useAsync(`ws-en-${word}`, async () => {
    const [meta, names, english] = await Promise.all([loadMeta(), loadNames(), loadEnglish(word)])
    if (!english) return { meta, names, english: null, words: [] }
    const words = await Promise.all(english.entry.strongs.map(([s]) => loadWord(s)))
    return { meta, names, english, words }
  })
  if (error) return <p className="message">{error.message}</p>
  if (!data) return <Loading />
  if (!data.english) return <NotFound what={`“${word}”`} english />
  return <EnglishDashboard {...data} english={data.english} />
}

function EnglishDashboard({ meta, names, english, words }: {
  meta: Meta
  names: Record<string, NameEntry>
  english: NonNullable<Awaited<ReturnType<typeof loadEnglish>>>
  words: (WordEntry | null)[]
}) {
  const { lemma, entry } = english
  const [mode, setMode] = useState<Mode>('count')

  // Every occurrence where the BSB uses this English word, with the Hebrew/Greek word behind it.
  const occurrences = useMemo(
    () =>
      entry.strongs
        .flatMap(([s, , renderings], i) => (words[i] ? occurrencesOf(s, words[i], renderings) : []))
        .sort(byPosition),
    [entry, words],
  )
  const perWord = entry.strongs.filter(([s]) => names[s])
  const top = perWord.slice(0, SERIES_COLORS.length)
  const colorOf = new Map(top.map(([s], i) => [s, SERIES_COLORS[i]]))
  const rest = new Set(perWord.slice(SERIES_COLORS.length).map(([s]) => s))
  const series: Series[] = [
    ...top.map(([s], i) => ({
      key: s,
      label: names[s][1],
      color: SERIES_COLORS[i],
      chapters: chapterCounts(meta, occurrences.filter((o) => o.strongs === s)),
    })),
    ...(rest.size
      ? [{ key: 'other', label: 'Other', color: OTHER_COLOR, chapters: chapterCounts(meta, occurrences.filter((o) => rest.has(o.strongs))) }]
      : []),
  ]
  const counts = useMemo(() => chapterCounts(meta, occurrences), [meta, occurrences])
  const verses = new Set(occurrences.map((o) => `${o.book}.${o.chapter}.${o.verse}`)).size
  const forms = Object.keys(entry.forms)

  return (
    <article className="ws-page">
      <header className="ws-title">
        <p className="ws-kicker">English · Berean Standard Bible</p>
        <h1>{lemma}</h1>
        {forms.length > 1 && <p className="ws-gloss">Including {forms.filter((f) => f !== lemma).join(', ')}</p>}
      </header>

      <Stats items={[[occurrences.length, 'times'], [verses, 'verses'], [perWord.length, 'Hebrew and Greek words']]} />

      <Section title="Hebrew and Greek words" subtitle={`The original words the BSB translates as “${lemma}”.`}>
        <Folded
          items={perWord.map(([s, n]) => {
            const [l, t, g, , lg] = names[s]
            return {
              key: s,
              href: studyHash({ kind: 'word', strongs: s }),
              value: n,
              color: colorOf.get(s) ?? OTHER_COLOR,
              label: (
                <>
                  <span className="ws-lemma" lang={lg === 'g' ? 'grc' : 'he'}>{l}</span> {t}{' '}
                  <span className="muted">{g} · {LANGUAGE_NAMES[lg]}</span>
                </>
              ),
            }
          })}
          limit={8}
          render={(items) => <RankedBars items={items} />}
        />
      </Section>

      <Section title="Where it's used" actions={<ModeToggle mode={mode} onChange={setMode} />}>
        <BookChart meta={meta} series={series} mode={mode} />
      </Section>

      <Section title="Across the Bible" subtitle="Each row is a book, each square a chapter.">
        <BibleMap meta={meta} counts={counts} onChapter={(b, c) => goTo(verseHash(meta, { book: b, chapter: c }))} />
      </Section>

      <Section title="Every occurrence">
        <OccurrenceList
          meta={meta}
          occurrences={occurrences}
          groups={perWord.map(([s]) => ({ key: s, label: `${names[s][1]} (${names[s][2]})` }))}
          groupOf={(o) => o.strongs}
          groupLabel="Original word"
          highlight={() => forms}
          tag={(o) => {
            const n = names[o.strongs]
            return n ? <a href={studyHash({ kind: 'word', strongs: o.strongs })}>{n[1]}</a> : null
          }}
        />
      </Section>
    </article>
  )
}

// -----------------------------------------------------------------------------------------------
// Occurrences with their verse text

const PAGE = 20

function OccurrenceList({ meta, occurrences, groups, groupOf, groupLabel, highlight, tag }: {
  meta: Meta
  occurrences: Occurrence[]
  groups: { key: string; label: string }[]
  groupOf: (o: Occurrence) => string
  groupLabel: string
  /** Words or phrases to mark in the verse text. */
  highlight: (o: Occurrence) => string[]
  tag?: (o: Occurrence) => ReactNode
}) {
  const [book, setBook] = useState('')
  const [group, setGroup] = useState('')
  const [shown, setShown] = useState(PAGE)
  const sorted = useMemo(() => [...occurrences].sort(byPosition), [occurrences])
  const books = [...new Set(sorted.map((o) => o.book))]
  const groupCounts = new Map<string, number>()
  for (const o of sorted) groupCounts.set(groupOf(o), (groupCounts.get(groupOf(o)) ?? 0) + 1)
  const filtered = sorted.filter((o) => (!book || o.book === Number(book)) && (!group || groupOf(o) === group))

  // One entry per verse; a word used twice in a verse is still one verse to read.
  const seen = new Set<string>()
  const unique = filtered.filter((o) => {
    const k = `${o.book}.${o.chapter}.${o.verse}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  return (
    <div>
      <div className="ws-filters">
        <label>
          <span className="muted">Book</span>
          <select value={book} onChange={(e) => (setBook(e.target.value), setShown(PAGE))}>
            <option value="">All books</option>
            {books.map((b) => (
              <option key={b} value={b}>{meta.books[b].name}</option>
            ))}
          </select>
        </label>
        {groups.length > 1 && (
          <label>
            <span className="muted">{groupLabel}</span>
            <select value={group} onChange={(e) => (setGroup(e.target.value), setShown(PAGE))}>
              <option value="">All</option>
              {groups
                .filter((g) => groupCounts.has(g.key))
                .sort((a, b) => (groupCounts.get(b.key) ?? 0) - (groupCounts.get(a.key) ?? 0))
                .map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label} ({groupCounts.get(g.key)})
                  </option>
                ))}
              {groupCounts.has('-1') && <option value="-1">No English word of its own ({groupCounts.get('-1')})</option>}
            </select>
          </label>
        )}
        <span className="muted ws-filter-count">{formatCount(unique.length)} verses</span>
      </div>
      <ol className="ws-occurrences">
        {unique.slice(0, shown).map((o) => (
          <li key={`${o.book}.${o.chapter}.${o.verse}.${o.strongs}`}>
            <div className="ws-occ-head">
              <a href={verseHash(meta, o)}>{verseLabel(meta, o)}</a>
              {tag?.(o)}
            </div>
            <VerseText meta={meta} o={o} marks={filtered.filter((x) => x.book === o.book && x.chapter === o.chapter && x.verse === o.verse).flatMap(highlight)} />
          </li>
        ))}
      </ol>
      {unique.length > shown && (
        <button className="button secondary ws-more" onClick={() => setShown((n) => n + PAGE * 2)}>
          Show more ({formatCount(unique.length - shown)} left)
        </button>
      )}
    </div>
  )
}

const chapterText = new Map<string, Promise<Map<number, string>>>()

/** BSB verse texts of a chapter, by verse number. */
function bsbChapter(meta: Meta, book: number, chapter: number) {
  const key = `${book}.${chapter}`
  let p = chapterText.get(key)
  if (!p) {
    p = fetchFreeChapterOnly('BSB', meta.books[book].id, chapter).then(
      (d) => new Map(parseChapter(d.chapter.content).verses.map((v) => [v.number, v.text])),
    )
    p.catch(() => chapterText.delete(key))
    chapterText.set(key, p)
  }
  return p
}

function VerseText({ meta, o, marks }: { meta: Meta; o: Occurrence; marks: string[] }) {
  const { data, error } = useAsync(`bsb-${o.book}.${o.chapter}`, () => bsbChapter(meta, o.book, o.chapter))
  if (error) return <p className="muted ws-verse">Couldn't load the verse.</p>
  const text = data?.get(o.verse)
  if (text == null) return <p className="ws-verse muted">…</p>
  return <p className="ws-verse">{highlightText(text, marks)}</p>
}

// -----------------------------------------------------------------------------------------------
// Small parts

function Section({ title, subtitle, actions, children }: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="ws-section-card">
      <div className="ws-section-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

function Stats({ items }: { items: [number, string][] }) {
  return (
    <dl className="ws-stats">
      {items.map(([value, label], i) => (
        <div key={label} className={i === 0 ? 'hero' : undefined}>
          <dt>{label}</dt>
          <dd>{formatCount(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="ws-toggle" role="group" aria-label="Show as">
      <button aria-pressed={mode === 'count'} onClick={() => onChange('count')}>Times</button>
      <button aria-pressed={mode === 'rate'} onClick={() => onChange('rate')} title="Times per 1,000 Hebrew or Greek words, so long and short books compare fairly">
        Per 1,000 words
      </button>
    </div>
  )
}

/** The first `limit` items, with a button for the rest. */
function Folded<T>({ items, limit, render }: { items: T[]; limit: number; render: (items: T[]) => ReactNode }) {
  const [all, setAll] = useState(false)
  return (
    <>
      {render(all ? items : items.slice(0, limit))}
      {items.length > limit && (
        <button className="link ws-view-toggle" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </>
  )
}

function Loading() {
  return <p className="muted ws-loading">Loading…</p>
}

function NotFound({ what, english }: { what: string; english?: boolean }) {
  return (
    <div className="message">
      <p>Nothing found for {what}.</p>
      {english && (
        <p className="muted">
          The search covers words the Berean Standard Bible uses to translate a Hebrew or Greek word. Try another form
          of the word, or a related one.
        </p>
      )}
      <a className="button secondary" href={studyHash({ kind: 'home' })}>Back to word study</a>
    </div>
  )
}

