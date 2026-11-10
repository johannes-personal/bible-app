import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { isTouchScreen } from '../device'
import { Icon } from './Icon'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  /** Extra content under the title, e.g. a search box. */
  toolbar?: ReactNode
  size?: 'wide' | 'narrow'
}

/**
 * A modal panel: a centered dialog on larger screens. On phones, wide sheets (the pickers)
 * fill the screen above the on-screen keyboard, and narrow ones are bottom sheets.
 */
export function Sheet({ title, onClose, children, toolbar, size = 'wide' }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useLayoutEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    window.addEventListener('keydown', onKey)
    const unlock = lockScroll()
    const prevFocus = document.activeElement as HTMLElement | null
    if (!panel.current?.querySelector('[autofocus]')) panel.current?.focus({ preventScroll: true })

    // The on-screen keyboard covers the bottom of the screen without resizing the page. The
    // sheet stays full height (anything shorter shows the page behind it); its list gets room
    // at the bottom the size of the keyboard, so every result can be scrolled into view.
    const viewport = window.visualViewport
    const fit = () => {
      if (!viewport || !panel.current) return
      const keyboard = Math.max(0, Math.round(window.innerHeight - viewport.height))
      panel.current.style.setProperty('--keyboard', `${keyboard}px`)
      panel.current.style.setProperty('--visible-top', `${Math.max(0, viewport.offsetTop)}px`)
    }
    fit()
    viewport?.addEventListener('resize', fit)
    viewport?.addEventListener('scroll', fit)
    return () => {
      window.removeEventListener('keydown', onKey)
      viewport?.removeEventListener('resize', fit)
      viewport?.removeEventListener('scroll', fit)
      unlock()
      prevFocus?.focus?.({ preventScroll: true })
    }
  }, [])

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        className={`sheet sheet-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="sheet-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        {toolbar && <div className="sheet-toolbar">{toolbar}</div>}
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  )
}

/**
 * Stops the page behind a sheet from scrolling. `overflow: hidden` alone doesn't on iOS, so on
 * touch screens the body is pinned in place (at its scroll position) and put back afterwards.
 */
function lockScroll() {
  const { body } = document
  if (!isTouchScreen()) {
    // Elsewhere hiding the overflow is enough, and keeps the sticky header in place.
    const overflow = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = overflow
    }
  }
  const y = window.scrollY
  const prev = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width }
  body.style.overflow = 'hidden'
  body.style.position = 'fixed'
  body.style.top = `-${y}px`
  body.style.width = '100%'
  return () => {
    Object.assign(body.style, prev)
    window.scrollTo(0, y)
  }
}
