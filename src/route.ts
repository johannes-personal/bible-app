import { useEffect, useState } from 'react'
import type { ChapterRef } from './api'
import { load } from './storage'
import { preferredLanguages } from './lang'

// The current chapter lives in the URL hash (#/BSB/JHN/3) so links are shareable
// and the browser's back button works.

export const LAST_KEY = 'bible:last'

export function parseHash(hash: string): ChapterRef | null {
  const m = /^#\/([^/]+)\/([^/]+)\/(\d+)$/.exec(hash)
  if (!m) return null
  return { translationId: decodeURIComponent(m[1]), book: m[2].toUpperCase(), chapter: Number(m[3]) }
}

export function hashFor(ref: ChapterRef): string {
  return `#/${encodeURIComponent(ref.translationId)}/${ref.book}/${ref.chapter}`
}

function defaultRef(): ChapterRef {
  const last = load<ChapterRef | null>(LAST_KEY, null)
  if (last) return last
  const translationId = preferredLanguages()[0] === 'sv' ? 'swe_fol' : 'BSB'
  return { translationId, book: 'JHN', chapter: 1 }
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
