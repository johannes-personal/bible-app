import { useEffect, useState } from 'react'
import type { ChapterRef } from './api'
import { load } from './storage'

// The current chapter lives in the URL hash (#/BSB/JHN/3, or #/BSB/JHN/3/16 to point at a
// verse) so links are shareable and the browser's back button works.

export const LAST_KEY = 'bible:last'

export function parseHash(hash: string): ChapterRef | null {
  const m = /^#\/([^/]+)\/([^/]+)\/(\d+)(?:\/(\d+))?$/.exec(hash)
  if (!m) return null
  const ref: ChapterRef = { translationId: decodeURIComponent(m[1]), book: m[2].toUpperCase(), chapter: Number(m[3]) }
  if (m[4]) ref.verse = Number(m[4])
  return ref
}

export function hashFor(ref: ChapterRef): string {
  const verse = ref.verse ? `/${ref.verse}` : ''
  return `#/${encodeURIComponent(ref.translationId)}/${ref.book}/${ref.chapter}${verse}`
}

/** The chapter part of a reference, without any verse. */
export function chapterOf({ translationId, book, chapter }: ChapterRef): ChapterRef {
  return { translationId, book, chapter }
}

/** Where a first visit starts: John 1 in the NIV (from YouVersion). */
export const DEFAULT_TRANSLATION = 'yv-111'
/** Used instead when YouVersion is unavailable. */
export const FALLBACK_TRANSLATION = 'BSB'

const sameChapter = (a: ChapterRef, b: ChapterRef) =>
  a.translationId === b.translationId && a.book === b.book && a.chapter === b.chapter

/**
 * Where the app opens. Without a chapter in the URL it resumes the last reading position
 * (chapter and the verse that was at the top of the screen), or starts a first visit at
 * John 1 in the NIV. Reloading the saved chapter also resumes at the saved verse.
 */
export function initialRoute(hash: string, last: ChapterRef | null): ChapterRef {
  const fromHash = parseHash(hash)
  const resumeAt = (ref: ChapterRef) =>
    last?.verse ? { ...chapterOf(ref), verse: last.verse, resume: true } : chapterOf(ref)
  if (!fromHash) return last ? resumeAt(last) : { translationId: DEFAULT_TRANSLATION, book: 'JHN', chapter: 1 }
  if (!fromHash.verse && last && sameChapter(fromHash, last)) return resumeAt(fromHash)
  return fromHash
}

let replacedHash: string | null = null

/** Swaps the current page for another without a history entry (e.g. a word form for its base word). */
export function replaceHash(hash: string) {
  replacedHash = location.hash
  history.replaceState(null, '', hash)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/** The page the last `replaceHash` swapped out, once (so a trail of pages can drop it). */
export function takeReplacedHash(): string | null {
  const hash = replacedHash
  replacedHash = null
  return hash
}

/** Opens a page by its hash, adding it to the history. */
export function goTo(hash: string) {
  location.hash = hash
}

export function navigate(ref: ChapterRef, replace = false) {
  const hash = hashFor(ref)
  if (replace) {
    history.replaceState(null, '', hash)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    location.hash = hash
  }
}

let replacement: ChapterRef | null = null

/** Swaps the current route for `ref` without a history entry; a resumed position stays one. */
export function replaceRoute(ref: ChapterRef) {
  replacement = ref
  navigate(ref.resume ? chapterOf(ref) : ref, true)
}

export function useRoute(): ChapterRef {
  const [ref, setRef] = useState<ChapterRef>(() => initialRoute(location.hash, load<ChapterRef | null>(LAST_KEY, null)))

  useEffect(() => {
    // The URL shows the chapter; a resumed reading position stays out of it.
    if (!parseHash(location.hash) && !parseStudyHash(location.hash)) {
      history.replaceState(null, '', hashFor(ref.resume ? chapterOf(ref) : ref))
    }
    const onChange = () => {
      const next = parseHash(location.hash)
      const replaced = replacement
      replacement = null
      if (next) setRef(replaced ?? next)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
    // Only the initial route needs writing back to the URL.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return ref
}

// Word study pages: #/study, #/study/G0026 (a Hebrew or Greek word), #/study/en/love and
// verses found by a phrase, #/study/q/love%20one%20another (optionally /phrase or /words, the
// way the words are matched; otherwise the page picks).

export type SearchMode = 'phrase' | 'words'

export type StudyRoute =
  | { kind: 'home' }
  | { kind: 'word'; strongs: string }
  | { kind: 'english'; word: string }
  | { kind: 'search'; query: string; mode?: SearchMode }

/** "g26" -> "G0026"; null if it isn't a Strong's number. */
export function normalizeStrongs(s: string): string | null {
  const m = /^([GH])0*(\d{1,4})$/i.exec(s.trim())
  return m ? m[1].toUpperCase() + m[2].padStart(4, '0') : null
}

export function parseStudyHash(hash: string): StudyRoute | null {
  const m = /^#\/study(?:\/(.*))?$/.exec(hash)
  if (!m) return null
  const search = /^q\/([^/]+)(?:\/(phrase|words))?\/?$/.exec(m[1] ?? '')
  if (search) {
    const query = decodeURIComponent(search[1]).trim()
    if (query) return search[2] ? { kind: 'search', query, mode: search[2] as SearchMode } : { kind: 'search', query }
  }
  const rest = decodeURIComponent(m[1] ?? '').replace(/\/$/, '')
  if (!rest) return { kind: 'home' }
  const english = /^en\/(.+)$/.exec(rest)
  if (english) return { kind: 'english', word: english[1].toLowerCase() }
  const strongs = normalizeStrongs(rest)
  return strongs ? { kind: 'word', strongs } : { kind: 'home' }
}

export function studyHash(route: StudyRoute): string {
  if (route.kind === 'word') return `#/study/${route.strongs}`
  if (route.kind === 'english') return `#/study/en/${encodeURIComponent(route.word)}`
  if (route.kind === 'search') return `#/study/q/${encodeURIComponent(route.query)}${route.mode ? `/${route.mode}` : ''}`
  return '#/study'
}

export function useStudyRoute(): StudyRoute | null {
  const [route, setRoute] = useState(() => parseStudyHash(location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseStudyHash(location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
