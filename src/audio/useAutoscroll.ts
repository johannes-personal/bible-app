import { useCallback, useEffect, useState } from 'react'

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])

/**
 * Keeps the verse being read on screen. Scrolling by hand pauses following
 * until `resume` is called, so the reader can look around freely.
 */
export function useAutoscroll(index: number, enabled: boolean, active: boolean) {
  const [following, setFollowing] = useState(true)

  // Start following again whenever playback (re)starts.
  const [wasActive, setWasActive] = useState(active)
  if (active !== wasActive) {
    setWasActive(active)
    if (active) setFollowing(true)
  }

  useEffect(() => {
    if (!enabled || !active) return
    const stop = () => setFollowing(false)
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (SCROLL_KEYS.has(e.key) && !target.closest('input, select, textarea, button')) stop()
    }
    window.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('touchmove', stop, { passive: true })
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('wheel', stop)
      window.removeEventListener('touchmove', stop)
      window.removeEventListener('keydown', onKey)
    }
  }, [enabled, active])

  const scrollToVerse = useCallback((i: number, force: boolean) => {
    const el = document.querySelector<HTMLElement>(`.reader [data-index="${i}"]`)
    if (!el) return
    const header = document.querySelector('.app-header')?.getBoundingClientRect().bottom ?? 0
    const player = document.querySelector('.player')?.getBoundingClientRect().top ?? window.innerHeight
    const visible = player - header
    const rect = el.getBoundingClientRect()
    // Only move when the verse leaves the comfortable reading zone, then place
    // it near the top so the next few verses are visible too.
    const outOfZone = rect.top < header + 8 || rect.top > header + visible * 0.6
    if (force || outOfZone) {
      window.scrollTo({ top: window.scrollY + rect.top - header - visible * 0.2, behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    if (enabled && active && following && index >= 0) scrollToVerse(index, false)
  }, [index, enabled, active, following, scrollToVerse])

  const resume = useCallback(() => {
    setFollowing(true)
    if (index >= 0) scrollToVerse(index, true)
  }, [index, scrollToVerse])

  return { following: following || !enabled || !active, resume }
}
