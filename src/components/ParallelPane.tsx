import { useEffect, useRef, type ReactNode } from 'react'
import { alignVerses } from '../versification'

// On phones, the second translation of a side-by-side reading gets the bottom half of the
// screen, scrolling on its own. The two follow each other: scrolling either one brings the
// other to the same verse (and as far through it). The first translation keeps the page's own
// scroll, so read-aloud, autoscroll and the reading position work as usual.

const clamp = (n: number) => Math.min(1, Math.max(0, n))

export function ParallelPane({ label, message, book, firstVerses, secondVerses, children }: {
  label: ReactNode
  message?: ReactNode
  book: string
  /** Verse numbers of the first and second translation, in order. */
  firstVerses: number[]
  secondVerses: number[]
  children: ReactNode
}) {
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const pane = body.current
    if (!pane || !firstVerses.length || !secondVerses.length) return
    const rows = alignVerses(book, firstVerses, secondVerses.map((n) => ({ number: n, item: n })))
    const toSecond = new Map<number, number>()
    const toFirst = new Map<number, number>()
    let last = secondVerses[0]
    firstVerses.forEach((n, i) => {
      if (rows[i].length) last = rows[i][0]
      toSecond.set(n, last)
      for (const s of rows[i]) toFirst.set(s, n)
    })

    // Scroll positions we set ourselves, so the scroll events they cause aren't echoed back.
    let ownPage = -1
    let ownPane = -1
    let frame = 0
    const pageTop = () => document.querySelector('.app-header')?.getBoundingClientRect().bottom ?? 0
    /** The first verse not yet scrolled past `top`, how far through it `top` is, and the gap above it. */
    const position = (verses: HTMLElement[], top: number) => {
      const el = verses.find((v) => v.getBoundingClientRect().bottom > top + 1)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { el, through: clamp((top - r.top) / Math.max(1, r.height)), gap: Math.max(0, r.top - top) }
    }

    const followPage = () => {
      const top = pageTop()
      const at = position([...document.querySelectorAll<HTMLElement>('.content .reader .verse[data-verse]')], top)
      if (!at) return
      const target = pane.querySelector<HTMLElement>(`[data-second-verse="${toSecond.get(Number(at.el.dataset.verse))}"]`)
      if (!target) return
      const r = target.getBoundingClientRect()
      const y = pane.scrollTop + r.top - pane.getBoundingClientRect().top + at.through * r.height - at.gap
      const next = Math.max(0, Math.round(y))
      if (Math.abs(pane.scrollTop - next) < 2) return
      pane.scrollTop = next
      ownPane = pane.scrollTop
    }
    const followPane = () => {
      const top = pane.getBoundingClientRect().top
      const at = position([...pane.querySelectorAll<HTMLElement>('[data-second-verse]')], top)
      if (!at) return
      const target = document.getElementById(`v${toFirst.get(Number(at.el.dataset.secondVerse))}`)
      if (!target) return
      const r = target.getBoundingClientRect()
      const y = window.scrollY + r.top - pageTop() + at.through * r.height - at.gap
      const next = Math.max(0, Math.round(y))
      if (Math.abs(window.scrollY - next) < 2) return
      window.scrollTo(0, next)
      ownPage = window.scrollY
    }

    const onPage = () => {
      if (ownPage >= 0 && Math.abs(window.scrollY - ownPage) < 2) return
      ownPage = -1
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(followPage)
    }
    const onPane = () => {
      if (ownPane >= 0 && Math.abs(pane.scrollTop - ownPane) < 2) return
      ownPane = -1
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(followPane)
    }
    followPage()
    window.addEventListener('scroll', onPage, { passive: true })
    pane.addEventListener('scroll', onPane, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onPage)
      pane.removeEventListener('scroll', onPane)
    }
  }, [book, firstVerses, secondVerses])

  return (
    <section className="parallel-pane" aria-label="Second translation">
      <div className="parallel-pane-head">{label}</div>
      <div ref={body} className="parallel-pane-body">
        {message && <p className="parallel-message muted">{message}</p>}
        {children}
      </div>
    </section>
  )
}
