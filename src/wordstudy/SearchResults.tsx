import { Fragment, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { Book, ChapterRef } from '../api'
import { Icon } from '../components/Icon'
import { useAsync } from '../hooks'
import { parseReference, referenceFinder, referenceLabel } from '../references'
import { DEFAULT_TRANSLATION, hashFor, LAST_KEY, normalizeStrongs, parseHash, studyHash } from '../route'
import { load as loadStored } from '../storage'
import { saveStudyReturn } from '../studyReturn'
import { decodeVerse, fold, formatCount, LANGUAGE_NAMES, loadMeta, loadNames, suggestEnglish, suggestOriginal, verseHash, type NameEntry } from './data'
import { splitMarked } from './highlight'
import {
  bestMatches,
  completion,
  endsMidWord,
  findAllWords,
  findPhrase,
  formsOf,
  isPhrase,
  loadVerseText,
  matchedWords,
  parseQuery,
  snippet,
} from './phrase'
import './wordstudy.css'

// What a search box shows while typing, in word study and in the reader: a typed reference,
// the verses that match best, the way to all of them, and the words to study. Nothing opens
// until a result is picked (tapped, or chosen with the arrow keys and Enter).

interface Result {
  key: string
  hash: string
  label: ReactNode
  hint: string
  /** A verse: shown on two lines (reference, then the text around the match). */
  verse?: boolean
  /** A heading above it, starting a group ("Verses", "Words"). */
  section?: string
  /** For a verse: the search, as remembered for the reader. */
  search?: string
}

/** How many verses to show among the results. */
const VERSES_SHOWN = 5

export default function SearchResults({ query, input, onPicked, books, translationId, remember = true, footer }: {
  query: string
  /** The search box, for the arrow keys and Enter. */
  input: RefObject<HTMLInputElement | null>
  /** After a result is picked (to close the panel). */
  onPicked: () => void
  /** The book names of the translation being read, for typed references. */
  books?: Book[]
  /** Where verses and references open; defaults to the translation last read. */
  translationId?: string
  /** Picking a verse remembers the search, so the reader marks it. */
  remember?: boolean
  /** A last link after the results (e.g. to word study's start page). */
  footer?: { hash: string; label: string; hint?: string }
}) {
  const [results, setResults] = useState<Result[]>([])
  // Nothing is chosen until the arrow keys choose it, so Enter never jumps away by itself.
  const [active, setActive] = useState(-1)
  const { data: names } = useAsync('ws-names', loadNames)
  const panel = useRef<HTMLUListElement>(null)
  const latest = useRef({ results, active })
  latest.current = { results, active }

  useEffect(() => {
    let live = true
    const raw = query
    const q = raw.trim()
    // A second word means verses are wanted: start loading their text straight away.
    if (isPhrase(q)) void loadVerseText().catch(() => {})
    const timer = setTimeout(async () => {
      const show = (list: Result[]) => {
        if (!live) return
        const extra: Result[] = footer ? [{ key: 'footer', hash: footer.hash, label: footer.label, hint: footer.hint ?? '' }] : []
        setResults([...list, ...extra])
        setActive(-1)
      }
      if (!q) return show([])

      // A reference ("jn 3:16", "Psalm 23"): straight to it.
      const reference = parseReference(q, referenceFinder(books ?? []))
      const readIn = translationId ?? loadStored<ChapterRef | null>(LAST_KEY, null)?.translationId ?? DEFAULT_TRANSLATION
      const top: Result[] =
        reference && (!books || books.some((b) => b.id === reference.book))
          ? [
              {
                key: 'reference',
                hash: hashFor({ translationId: readIn, ...reference }),
                section: 'Go to',
                label: (
                  <span className="ws-verse-search">
                    <Icon name="chevronRight" />{' '}
                    {reference.verse
                      ? referenceLabel({ ...reference, verseStart: reference.verse, verseEnd: reference.verse }, books)
                      : `${referenceLabel({ ...reference, verseStart: 1, verseEnd: 1 }, books).replace(/:1$/, '')}`}
                  </span>
                ),
                hint: '',
              },
            ]
          : []

      // Words: exact matches first (in either language), then the most used.
      const ranked: { r: Result; rank: number }[] = []
      const strongs = normalizeStrongs(q)
      if (strongs && names?.[strongs]) ranked.push({ r: originalResult(strongs, names[strongs]), rank: Infinity })
      for (const e of await suggestEnglish(q, 6)) {
        ranked.push({
          r: { key: `en-${e.lemma}`, hash: studyHash({ kind: 'english', word: e.lemma }), label: e.lemma, hint: `English · ${formatCount(e.total)}×` },
          rank: (e.lemma === q.toLowerCase() ? 1e6 : 0) + e.total,
        })
      }
      if (names) {
        for (const s of suggestOriginal(names, q, 6)) {
          if (s === strongs) continue
          const [lemma, translit, , count] = names[s]
          const exact = fold(translit) === fold(q) || fold(lemma) === fold(q)
          ranked.push({ r: originalResult(s, names[s]), rank: (exact ? 1e6 : 0) + count })
        }
      }
      const words = ranked
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 8)
        .map((x, i): Result => ({ ...x.r, section: i === 0 ? 'Words' : undefined }))

      const allVerses = (search: string, count: number | 'loading' | null): Result => ({
        key: 'verses',
        hash: studyHash({ kind: 'search', query: search }),
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
                    ? 'Open in word study, with the Hebrew and Greek'
                    : `See all ${formatCount(count)} verses, with the Hebrew and Greek`}
          </span>
        ),
        hint: '',
      })

      if (strongs || reference) return show([...top, ...words])
      // A single word: its study pages first, then the way to verses with it (names, places…).
      if (!isPhrase(q)) return show([...words, allVerses(q, null)])

      // A phrase: verses first, the best ones as soon as the text is in.
      show([{ ...allVerses(q, 'loading'), section: 'Verses' }, ...words])
      const { words: terms } = parseQuery(q)
      // Still typing the last word: match it as a beginning ("love one ano" → "another").
      const partial = endsMidWord(raw)
      const [meta, text, forms] = await Promise.all([loadMeta(), loadVerseText(), formsOf(partial ? terms.slice(0, -1) : terms)])
      if (!live) return
      const allForms = partial ? [...forms, [terms.at(-1)!]] : forms
      // The exact phrase when it's there (as the results page starts with); otherwise the verses
      // with all the words, closest together first.
      const exact = findPhrase(text, terms, partial)
      const matching = exact.length ? exact : bestMatches(findAllWords(text, allForms, partial), terms, allForms, Infinity, partial)
      // "See all" searches for the words as the verses complete them.
      const search = partial && matching.length ? [...terms.slice(0, -1), completion(matching, terms.at(-1)!)].join(' ') : q
      const verses = matching.slice(0, VERSES_SHOWN).map((v, i): Result => {
        const o = decodeVerse(v.code)
        const marks = matchedWords(v, terms, allForms, partial)
        return {
          key: `v${v.code}`,
          hash: translationId
            ? hashFor({ translationId, book: meta.books[o.book].id, chapter: o.chapter, verse: o.verse })
            : verseHash(meta, o),
          verse: true,
          section: i === 0 ? (exact.length ? 'Verses' : 'Closest verses') : undefined,
          label: (
            <>
              <strong>
                {books?.find((b) => b.id === meta.books[o.book].id)?.name ?? meta.books[o.book].name} {o.chapter}:{o.verse}
              </strong>
              <span className="ws-suggestion-text">
                {splitMarked(snippet(v.text, marks), marks).map((p, i) => (p.marked ? <mark key={i}>{p.text}</mark> : p.text))}
              </span>
            </>
          ),
          hint: '',
          search,
        }
      })
      const all = allVerses(search, matching.length)
      show(matching.length ? [...verses, all, ...words] : [{ ...all, section: 'Verses' }, ...words])
    }, 100)
    return () => {
      live = false
      clearTimeout(timer)
    }
    // `footer` and `books` are fixed for a search box.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [query, names, translationId])

  // Keep the panel above the on-screen keyboard.
  useEffect(() => {
    const viewport = window.visualViewport
    const fit = () => {
      const p = panel.current
      if (!p) return
      const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight
      p.style.maxHeight = `${Math.max(160, bottom - p.getBoundingClientRect().top - 12)}px`
    }
    fit()
    viewport?.addEventListener('resize', fit)
    window.addEventListener('resize', fit)
    return () => {
      viewport?.removeEventListener('resize', fit)
      window.removeEventListener('resize', fit)
    }
  }, [results])

  /** Opening a result. A verse can remember the search, so the reader marks it there. */
  const pick = (r: Result) => {
    if (r.verse && remember) {
      const o = parseHash(r.hash)
      if (o) {
        saveStudyReturn({
          hash: studyHash({ kind: 'search', query: r.search ?? query.trim() }),
          label: { text: `“${r.search ?? query.trim()}”`, gloss: 'verses' },
          word: { kind: 'search', query: r.search ?? query.trim() },
          book: o.book,
          chapter: o.chapter,
        })
      }
    }
    onPicked()
  }

  // Arrow keys choose a result; Enter opens the chosen one (and only then).
  useEffect(() => {
    const el = input.current
    if (!el) return
    const onKey = (e: KeyboardEvent) => {
      const { results, active } = latest.current
      if (e.key === 'ArrowDown') setActive(Math.min(active + 1, results.length - 1))
      else if (e.key === 'ArrowUp') setActive(Math.max(active - 1, -1))
      else if (e.key === 'Enter' && results[active]) {
        pick(results[active])
        location.hash = results[active].hash
      } else return
      e.preventDefault()
    }
    el.addEventListener('keydown', onKey)
    return () => el.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (active >= 0) input.current?.setAttribute('aria-activedescendant', `ws-s-${active}`)
    else input.current?.removeAttribute('aria-activedescendant')
  }, [active, input])

  if (!results.length) return null
  return (
    <ul ref={panel} className="ws-suggestions" id="ws-suggestions" role="listbox">
      {results.map((r, i) => (
        <Fragment key={r.key}>
          {r.section && (
            <li className="ws-suggestion-section" role="presentation">
              {r.section}
            </li>
          )}
          <li id={`ws-s-${i}`} role="option" aria-selected={i === active}>
            <a
              href={r.hash}
              className={[i === active && 'active', r.verse && 'ws-suggestion-verse'].filter(Boolean).join(' ') || undefined}
              onClick={() => pick(r)}
            >
              {r.verse ? (
                r.label
              ) : (
                <>
                  <span>{r.label}</span>
                  <span className="muted">{r.hint}</span>
                </>
              )}
            </a>
          </li>
        </Fragment>
      ))}
    </ul>
  )
}

function originalResult(strongs: string, [lemma, translit, gloss, count, lang]: NameEntry): Result {
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

