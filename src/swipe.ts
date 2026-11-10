import { useEffect } from 'react'

// Swiping the chapter sideways on a touch screen turns the page: towards the left for the next
// chapter, the right for the previous one (the other way round in right-to-left translations).
// The text follows the finger a little, so the gesture is visible before it's committed.

/** Touches starting this close to the screen's edges are left to the system's back gesture. */
const EDGE = 24
/** How far the finger must travel sideways to turn the page. */
const DISTANCE = 70
/** A swipe slower than this is taken for something else (e.g. selecting text). */
const MAX_MS = 800

export function useSwipe({ enabled, rtl, onNext, onPrevious }: {
  enabled: boolean
  rtl: boolean
  onNext: () => void
  onPrevious: () => void
}) {
  useEffect(() => {
    if (!enabled) return
    let start: { x: number; y: number; t: number } | null = null
    let horizontal = false
    const reader = () => document.querySelector<HTMLElement>('.content .reader')
    const selecting = () => !!window.getSelection()?.toString()

    const settle = () => {
      const r = reader()
      if (!r || !r.style.transform) return
      r.style.transition = 'transform 0.2s ease-out, opacity 0.2s ease-out'
      r.style.transform = ''
      r.style.opacity = ''
    }
    const onStart = (e: TouchEvent) => {
      start = null
      horizontal = false
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      const target = e.target as Element
      if (!target.closest('.content') || target.closest('.note-popover, .study-bar, .parallel-pane-head, input, textarea')) return
      if (t.clientX < EDGE || t.clientX > window.innerWidth - EDGE) return
      start = { x: t.clientX, y: t.clientY, t: Date.now() }
    }
    const onMove = (e: TouchEvent) => {
      if (!start) return
      const t = e.touches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      if (!horizontal) {
        // Scrolling up or down: leave it alone.
        if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) {
          start = null
          return
        }
        if (Math.abs(dx) > 12 && Math.abs(dx) > 2 * Math.abs(dy)) horizontal = true
      }
      if (!horizontal || selecting()) return
      const r = reader()
      if (!r) return
      r.style.transition = 'none'
      r.style.transform = `translateX(${dx * 0.35}px)`
      r.style.opacity = String(1 - Math.min(Math.abs(dx) / 600, 0.35))
    }
    const onEnd = (e: TouchEvent) => {
      if (!start) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      const turn =
        horizontal && Math.abs(dx) > DISTANCE && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - start.t < MAX_MS && !selecting()
      start = null
      settle()
      if (!turn) return
      const towardsNext = rtl ? dx > 0 : dx < 0
      if (towardsNext) onNext()
      else onPrevious()
    }
    const onCancel = () => {
      start = null
      settle()
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onCancel, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onCancel)
      settle()
    }
  }, [enabled, rtl, onNext, onPrevious])
}
