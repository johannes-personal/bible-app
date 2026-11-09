import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ChapterRef } from '../api'
import { Icon } from '../components/Icon'
import { useAsync } from '../hooks'
import { goTo, hashFor, LAST_KEY, normalizeStrongs, studyHash, type StudyRoute } from '../route'
import { useSettings } from '../settings'
import { load as loadStored } from '../storage'
import { EnglishPage, WordPage } from './dashboards'
import { fold, formatCount, LANGUAGE_NAMES, loadNames, suggestEnglish, suggestOriginal, type NameEntry } from './data'
import './wordstudy.css'

// Word study: search English words or Hebrew/Greek words, and see where and how they're used.
// Built on the Berean Standard Bible interlinear, where each English word is tied to the
// Hebrew or Greek word it translates.

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
          (Tyndale House, CC BY 4.0) and Strong's dictionaries (public domain).
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
