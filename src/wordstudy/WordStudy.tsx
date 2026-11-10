import { useEffect, useRef, useState } from 'react'
import type { ChapterRef } from '../api'
import { Icon } from '../components/Icon'
import { isTouchScreen } from '../device'
import { useAsync } from '../hooks'
import { hashFor, LAST_KEY, parseHash, parseStudyHash, studyHash, takeReplacedHash, type StudyRoute } from '../route'
import { useSettings } from '../settings'
import { load as loadStored } from '../storage'
import { clearStudyReturn, saveStudyReturn } from '../studyReturn'
import { EnglishPage, SearchPage, WordPage } from './dashboards'
import SearchResults from './SearchResults'
import { loadNames } from './data'
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
  useReturnFromReader(route)
  const compact = useTitleScrolledAway(route)
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setSearching(false)
  }, [route])

  return (
    <div className="ws">
      <header className={`app-header ws-header${compact ? ' compact' : ''}${searching ? ' searching' : ''}`}>
        <div className="header-inner">
          <a className="icon-button" href={backHash} aria-label="Back to reading" data-no-return>
            <Icon name="back" />
          </a>
          {compact && <CurrentWord route={route} />}
          <SearchBox route={route} focus={searching} onLeave={() => setSearching(false)} />
          {compact && !searching && (
            <button className="icon-button ws-search-toggle" aria-label="Search for a word" onClick={() => setSearching(true)}>
              <Icon name="search" />
            </button>
          )}
        </div>
      </header>
      <main className="ws-main">
        <Trail route={route} />
        {route.kind === 'home' && <Home />}
        {route.kind === 'word' && <WordPage key={route.strongs} strongs={route.strongs} />}
        {route.kind === 'english' && <EnglishPage key={route.word} word={route.word} />}
        {route.kind === 'search' && <SearchPage key={`${route.query}/${route.mode}`} query={route.query} mode={route.mode} />}
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

/**
 * Following a link from a word's page into the reader remembers the word, so the reader can
 * mark it in that chapter and lead back here. The back-to-reading button doesn't.
 */
function useReturnFromReader(route: StudyRoute) {
  const { data: names } = useAsync('ws-names', loadNames)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element).closest?.<HTMLAnchorElement>('a[href^="#/"]')
      if (!link) return
      if (link.hasAttribute('data-no-return')) return clearStudyReturn()
      const target = parseHash(link.getAttribute('href') ?? '')
      if (!target || route.kind === 'home') return
      const name = route.kind === 'word' ? names?.[route.strongs] : undefined
      saveStudyReturn({
        hash: location.hash,
        label:
          route.kind === 'english'
            ? { text: route.word, gloss: 'English' }
            : route.kind === 'search'
              ? { text: `“${route.query}”`, gloss: 'verses' }
              : name
                ? { original: name[0], lang: name[4] === 'g' ? 'grc' : 'he', text: name[1], gloss: name[2] }
                : { text: route.strongs },
        word:
          route.kind === 'word'
            ? { kind: 'word', strongs: route.strongs }
            : route.kind === 'english'
              ? { kind: 'english', word: route.word }
              : { kind: 'search', query: route.query, mode: route.mode },
        book: target.book,
        chapter: target.chapter,
      })
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [route, names])
}

/**
 * Whether the page's title (the word being studied) has scrolled up under the header, so the
 * header should name the word instead.
 */
function useTitleScrolledAway(route: StudyRoute) {
  const [away, setAway] = useState(false)
  useEffect(() => {
    let frame = 0
    const check = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const title = document.querySelector('.ws-title')
        const header = document.querySelector('.ws-header')?.getBoundingClientRect().bottom ?? 0
        setAway(!!title && title.getBoundingClientRect().bottom < header)
      })
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [route])
  return away && route.kind !== 'home'
}

/** The word being studied, for the header once its title has scrolled away; tap to go back up. */
function CurrentWord({ route }: { route: StudyRoute }) {
  const { data: names } = useAsync('ws-names', loadNames)
  const name = route.kind === 'word' ? names?.[route.strongs] : undefined
  return (
    <button className="ws-current" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="Back to the top">
      {route.kind === 'english' ? (
        <>
          <span className="ws-current-word">{route.word}</span>
          <span className="muted"> · English</span>
        </>
      ) : route.kind === 'search' ? (
        <>
          <span className="ws-current-word">“{route.query}”</span>
          <span className="muted"> · verses</span>
        </>
      ) : name ? (
        <>
          <span className="ws-lemma" lang={name[4] === 'g' ? 'grc' : 'he'}>{name[0]}</span>{' '}
          <span className="ws-current-word">{name[1]}</span>
          <span className="muted"> · {name[2]}</span>
        </>
      ) : null}
    </button>
  )
}

function SearchBox({ route, focus, onLeave }: { route: StudyRoute; focus?: boolean; onLeave?: () => void }) {
  const [query, setQuery] = useState(route.kind === 'english' ? route.word : route.kind === 'search' ? route.query : '')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Opened from the header's search button (while scrolled down on a phone).
  useEffect(() => {
    if (focus) inputRef.current?.focus({ preventScroll: true })
  }, [focus])

  // A new page shows its own word in the box (or nothing), with the results closed.
  const routeWord = route.kind === 'english' ? route.word : route.kind === 'search' ? route.query : ''
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setQuery(routeWord)
    setOpen(false)
    if (route.kind === 'home') inputRef.current?.focus()
  }, [route, routeWord])

  const close = () => {
    setOpen(false)
    onLeave?.()
  }

  // The results stay open while reading them (also with the keyboard put away), until a tap
  // outside, Escape, or picking one.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!formRef.current?.contains(e.target as Node)) close()
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
    // `close` only sets state and calls the latest onLeave.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <form
      ref={formRef}
      className="ws-search"
      role="search"
      onSubmit={(e) => {
        // Enter (with no result chosen) never leaves the page; on a phone it puts the keyboard
        // away so the results can be read and tapped.
        e.preventDefault()
        setOpen(true)
        if (isTouchScreen()) inputRef.current?.blur()
      }}
    >
      <Icon name="search" />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        value={query}
        placeholder="A word or phrase: love, chesed, G26, love one another…"
        aria-label="Search for a word or verses"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="ws-suggestions"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // With nothing to show, a phone's header goes back to naming the word.
          if (!query.trim()) setTimeout(() => onLeave?.(), 150)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close()
          else if (e.key === 'ArrowDown') setOpen(true)
        }}
      />
      {query && (
        <button
          type="button"
          className="search-clear"
          aria-label="Clear the search"
          // Keep the keyboard up: don't let the tap take focus from the box.
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery('')
            setOpen(true)
            inputRef.current?.focus()
          }}
        >
          <Icon name="close" />
        </button>
      )}
      {open && (
        <SearchResults
          query={query}
          input={inputRef}
          onPicked={() => {
            setOpen(false)
            inputRef.current?.blur()
          }}
        />
      )}
    </form>
  )
}

const EXAMPLES: [string, string][] = [
  ['love', studyHash({ kind: 'english', word: 'love' })],
  ['mercy', studyHash({ kind: 'english', word: 'mercy' })],
  ['faith', studyHash({ kind: 'english', word: 'faith' })],
  ['chesed', studyHash({ kind: 'word', strongs: 'H2617' })],
  ['shalom', studyHash({ kind: 'word', strongs: 'H7965' })],
  ['agapē', studyHash({ kind: 'word', strongs: 'G0026' })],
  ['logos', studyHash({ kind: 'word', strongs: 'G3056' })],
  ['“love one another”', studyHash({ kind: 'search', query: 'love one another' })],
  ['“do not be afraid”', studyHash({ kind: 'search', query: 'do not be afraid' })],
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
// Trail: the words looked at recently, in either language, for going back and forth.

const TRAIL_KEY = 'bible:study-trail'
const TRAIL_LENGTH = 8

function loadTrail(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(TRAIL_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function Trail({ route }: { route: StudyRoute }) {
  const { data: names } = useAsync('ws-names', loadNames)
  const current = route.kind === 'home' ? null : studyHash(route)
  const [trail, setTrail] = useState(loadTrail)

  useEffect(() => {
    if (!current) return
    const replaced = takeReplacedHash() // a word form swapped for its base word isn't a visit of its own
    const next = [...loadTrail().filter((h) => h !== current && h !== replaced), current].slice(-TRAIL_LENGTH)
    try {
      sessionStorage.setItem(TRAIL_KEY, JSON.stringify(next))
    } catch {
      // The trail is a convenience only.
    }
    // oxlint-disable-next-line react/set-state-in-effect
    setTrail(next)
  }, [current])

  const items = trail
    .map((hash) => ({ hash, route: parseStudyHash(hash) }))
    .filter((t) => t.route && t.route.kind !== 'home')
  if (items.length < 2) return null
  return (
    <nav className="ws-trail" aria-label="Recently studied">
      <span className="muted">Recent</span>
      {items.map(({ hash, route: r }) => {
        const label =
          r!.kind === 'word'
            ? (names?.[r!.strongs]?.[1] ?? r!.strongs)
            : r!.kind === 'english'
              ? `“${r!.word}”`
              : r!.kind === 'search'
                ? `“${r!.query}” · verses`
                : ''
        return hash === current ? (
          <span key={hash} className="ws-trail-item current" aria-current="page">{label}</span>
        ) : (
          <a key={hash} className="ws-trail-item" href={hash}>{label}</a>
        )
      })}
    </nav>
  )
}
