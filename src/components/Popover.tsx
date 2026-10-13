import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const canHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches

interface Props {
  /** Class of the inline wrapper around the trigger button. */
  className: string
  /** Accessible name of the trigger and the panel. */
  label: string
  /** Content of the trigger button. */
  trigger: ReactNode
  /** Panel content; `close` dismisses the popover (e.g. after following a link). */
  children: (close: () => void) => ReactNode
}

/**
 * An inline trigger with a popover panel. Hovering opens it where the device can hover
 * (closing when the pointer leaves); a click or tap pins it open until Escape or a click
 * elsewhere. The panel sits under the trigger, or above it when there is no room below.
 */
export function Popover({ className, label, trigger, children }: Props) {
  const [open, setOpen] = useState<'hover' | 'pinned' | null>(null)
  const anchor = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)

  const close = () => setOpen(null)
  const cancelClose = () => clearTimeout(closeTimer.current)
  const hoverIn = () => {
    cancelClose()
    if (canHover() && !open) setOpen('hover')
  }
  const hoverOut = () => {
    if (open !== 'hover') return
    cancelClose()
    closeTimer.current = setTimeout(close, 250)
  }

  // Place the panel under the trigger, or above it when there is no room below.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const a = anchor.current?.getBoundingClientRect()
      const p = panel.current
      if (!a || !p) return
      const width = Math.min(380, window.innerWidth - 24)
      const left = Math.min(Math.max(12, a.left + a.width / 2 - width / 2), window.innerWidth - width - 12)
      const bottomLimit = document.querySelector('.player')?.getBoundingClientRect().top ?? window.innerHeight
      const height = p.offsetHeight
      const below = a.bottom + 8
      const top = below + height > bottomLimit - 8 && a.top - 8 - height > 8 ? a.top - 8 - height : below
      setPosition({ top, left, width })
    }
    place()
    window.addEventListener('scroll', place, { passive: true })
    window.addEventListener('resize', place)
    const observer = new ResizeObserver(place)
    if (panel.current) observer.observe(panel.current)
    return () => {
      window.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
      observer.disconnect()
    }
  }, [open])

  // A pinned popover closes on Escape or a click elsewhere.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!panel.current?.contains(target) && !anchor.current?.contains(target)) close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  useEffect(() => {
    return () => clearTimeout(closeTimer.current)
  }, [])

  return (
    <sup className={className}>
      <button
        ref={anchor}
        type="button"
        aria-label={label}
        aria-expanded={!!open}
        onClick={(e) => {
          e.stopPropagation() // don't also trigger the verse's click-to-play
          setOpen((o) => (o === 'pinned' ? null : 'pinned'))
        }}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            className="note-popover"
            role="dialog"
            aria-label={label}
            style={position ? { top: position.top, left: position.left, width: position.width } : { visibility: 'hidden' }}
            onMouseEnter={cancelClose}
            onMouseLeave={hoverOut}
            onClick={(e) => e.stopPropagation()}
          >
            {children(close)}
          </div>,
          document.body,
        )}
    </sup>
  )
}
