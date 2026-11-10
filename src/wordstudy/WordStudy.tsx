import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ChapterRef } from '../api'
import { Icon } from '../components/Icon'
import { isTouchScreen } from '../device'
import { useAsync } from '../hooks'
import { goTo, hashFor, LAST_KEY, normalizeStrongs, parseHash, parseStudyHash, studyHash, takeReplacedHash, type StudyRoute } from '../route'
import { useSettings } from '../settings'
import { load as loadStored } from '../storage'
import { clearStudyReturn, saveStudyReturn } from '../studyReturn'
import { EnglishPage, SearchPage, WordPage } from './dashboards'
import { bestMatches, findAllWords, findPhrase, formsOf, isPhrase, loadVerseText, parseQuery, snippet } from './phrase'
import { splitMarked } from './highlight'
import { decodeVerse, fold, formatCount, LANGUAGE_NAMES, loadMeta, loadNames, suggestEnglish, suggestOriginal, verseHash, type NameEntry } from './data'
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

interface Suggestion {
  key: string
  hash: string
  label: ReactNode
  hint: string
  /** A verse: shown on two lines (reference, then the text around the match). */
  verse?: boolean
  /** A heading shown above it, starting a group ("Verses", "Words"). */
  section?: string
}

/** How many verses to show among the suggestions. */
const VERSE_SUGGESTIONS = 5

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
  // Nothing is chosen until the arrow keys choose it, so Enter never jumps away by itself.
  const [active, setActive] = useState(-1)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const { data: names } = useAsync('ws-names', loadNames)
  const inputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const panelRef = useRef<HTMLUListElement>(null)

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
    setActive(-1)
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

  // Keep the panel above the on-screen keyboard.
  useEffect(() => {
    if (!open) return
    const viewport = window.visualViewport
    const fit = () => {
      const panel = panelRef.current
      if (!panel) return
      const top = panel.getBoundingClientRect().top
      const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight
      panel.style.maxHeight = `${Math.max(160, bottom - top - 12)}px`
    }
    fit()
    viewport?.addEventListener('resize', fit)
    window.addEventListener('resize', fit)
    return () => {
      viewport?.removeEventListener('resize', fit)
      window.removeEventListener('resize', fit)
    }
  }, [open, suggestions])

  useEffect(() => {
    let live = true
    const q = query.trim()
    // A second word means verses are wanted: start loading their text straight away.
    if (isPhrase(q)) void loadVerseText().catch(() => {})
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
      const words = ranked
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 8)
        .map((r, i): Suggestion => ({ ...r.s, section: i === 0 ? 'Words' : undefined }))
      const allVerses = (count: number | 'loading' | null): Suggestion => ({
        key: 'verses',
        hash: studyHash({ kind: 'search', query: q }),
        label: (
          <span className="ws-verse-search">
            <Icon name="search" />{' '}
            {count === 'loading'
              ? 'Searching verses…'
              : count == null
                ? `Verses with “${q}”`
                : count === 0
                  ? `No verse has “${q}”`
                  : count === 1
                    ? 'Open in word study'
                    : `See all ${formatCount(count)} verses`}
          </span>
        ),
        hint: count === 'loading' || count === 0 ? '' : 'with the Hebrew and Greek',
      })
      const show = (list: Suggestion[]) => {
        if (!live) return
        setSuggestions(list)
        setActive(-1)
      }
      if (!q || strongs) return show(words)
      // A single word: its study pages first, then the way to verses with it (names, places…).
      if (!isPhrase(q)) return show([...words, allVerses(null)])
      // A phrase: verses first, the best ones as soon as the text is in.
      show([{ ...allVerses('loading'), section: 'Verses' }, ...words])
      const { words: terms } = parseQuery(q)
      const [meta, text, forms] = await Promise.all([loadMeta(), loadVerseText(), formsOf(terms)])
      if (!live) return
      // The exact phrase when it's there (as the results page starts with); otherwise the verses
      // with all the words, closest together first.
      const exact = findPhrase(text, terms)
      const matching = exact.length ? exact : bestMatches(findAllWords(text, forms), terms, forms)
      const marks = exact.length ? [terms.join(' ')] : [terms.join(' '), ...forms.flat()]
      const verses = matching.slice(0, VERSE_SUGGESTIONS).map((v, i): Suggestion => {
        const o = decodeVerse(v.code)
        return {
          key: `v${v.code}`,
          hash: verseHash(meta, o),
          verse: true,
          section: i === 0 ? (exact.length ? 'Verses' : 'Closest verses') : undefined,
          label: (
            <>
              <strong>
                {meta.books[o.book].name} {o.chapter}:{o.verse}
              </strong>
              <span className="ws-suggestion-text">
                {splitMarked(snippet(v.text, terms), marks).map((p, i) => (p.marked ? <mark key={i}>{p.text}</mark> : p.text))}
              </span>
            </>
          ),
          hint: '',
        }
      })
      const all = allVerses(matching.length)
      show(matching.length ? [...verses, all, ...words] : [{ ...all, section: 'Verses' }, ...words])
    }, 100)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [query, names])

  /** Opening a result. A verse remembers the search, so the reader marks it there. */
  const pick = (s: Suggestion) => {
    if (s.verse) {
      const o = parseHash(s.hash)
      if (o) {
        saveStudyReturn({
          hash: studyHash({ kind: 'search', query: query.trim() }),
          label: { text: `“${query.trim()}”`, gloss: 'verses' },
          word: { kind: 'search', query: query.trim() },
          book: o.book,
          chapter: o.chapter,
        })
      }
    }
    setOpen(false)
    setActive(-1)
    inputRef.current?.blur()
  }

  // Enter opens only a result chosen with the arrow keys. Otherwise it puts the keyboard away
  // (on a phone), leaving the results to read and tap.
  const submit = () => {
    const s = suggestions[active]
    if (open && s) {
      pick(s)
      goTo(s.hash)
      return
    }
    setOpen(true)
    if (isTouchScreen()) inputRef.current?.blur()
  }

  const showing = open && query.trim() && suggestions.length > 0

  return (
    <form
      ref={formRef}
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
        enterKeyHint="search"
        value={query}
        placeholder="A word or phrase: love, chesed, G26, love one another…"
        aria-label="Search for a word or verses"
        aria-autocomplete="list"
        aria-expanded={!!showing}
        aria-controls="ws-suggestions"
        aria-activedescendant={showing && active >= 0 ? `ws-s-${active}` : undefined}
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
          if (e.key === 'ArrowDown') {
            setOpen(true)
            setActive((a) => Math.min(a + 1, suggestions.length - 1))
          } else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, -1))
          else if (e.key === 'Escape') close()
          else return
          e.preventDefault()
        }}
      />
      {showing && (
        <ul ref={panelRef} className="ws-suggestions" id="ws-suggestions" role="listbox">
          {suggestions.map((s, i) => (
            <Fragment key={s.key}>
              {s.section && (
                <li className="ws-suggestion-section" role="presentation">
                  {s.section}
                </li>
              )}
              <li id={`ws-s-${i}`} role="option" aria-selected={i === active}>
                <a
                  href={s.hash}
                  className={[i === active && 'active', s.verse && 'ws-suggestion-verse'].filter(Boolean).join(' ') || undefined}
                  onClick={() => pick(s)}
                >
                  {s.verse ? (
                    s.label
                  ) : (
                    <>
                      <span>{s.label}</span>
                      <span className="muted">{s.hint}</span>
                    </>
                  )}
                </a>
              </li>
            </Fragment>
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
