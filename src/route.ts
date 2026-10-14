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
    if (!parseHash(location.hash)) history.replaceState(null, '', hashFor(ref.resume ? chapterOf(ref) : ref))
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
