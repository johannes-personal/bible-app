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

function defaultRef(): ChapterRef {
  return load<ChapterRef | null>(LAST_KEY, null) ?? { translationId: DEFAULT_TRANSLATION, book: 'JHN', chapter: 1 }
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

export function useRoute(): ChapterRef {
  const [ref, setRef] = useState<ChapterRef>(() => parseHash(location.hash) ?? defaultRef())

  useEffect(() => {
    if (!parseHash(location.hash)) history.replaceState(null, '', hashFor(ref))
    const onChange = () => {
      const next = parseHash(location.hash)
      if (next) setRef(next)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
    // Only the initial route needs writing back to the URL.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return ref
}
