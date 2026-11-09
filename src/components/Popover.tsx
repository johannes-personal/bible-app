import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const close = useCallback(() => setOpen(null), [])
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

  useEffect(() => {
    return () => clearTimeout(closeTimer.current)
  }, [])

  return (
    <sup className={className}>
      <button
        ref={setAnchor}
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
      {open && (
        <AnchoredPanel
          label={label}
          anchor={anchor}
          onClose={close}
          onMouseEnter={cancelClose}
          onMouseLeave={hoverOut}
        >
          {children(close)}
        </AnchoredPanel>
      )}
    </sup>
  )
}

/** Where a panel points: an element, or a point on the page (in page coordinates). */
export type Anchor = HTMLElement | { pageX: number; pageY: number } | null

const rectOf = (anchor: Anchor): { left: number; right: number; top: number; bottom: number } | null => {
  if (!anchor) return null
  if (anchor instanceof HTMLElement) return anchor.getBoundingClientRect()
  const x = anchor.pageX - window.scrollX
  const y = anchor.pageY - window.scrollY
  return { left: x, right: x, top: y - 12, bottom: y + 12 }
}

/**
 * A floating panel next to an anchor: under it, or above it when there is no room below
 * (keeping clear of the player bar). Closes on Escape or a press outside it and the anchor.
 */
export function AnchoredPanel({ label, anchor, onClose, onMouseEnter, onMouseLeave, className, children }: {
  label: string
  anchor: Anchor
  onClose: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  className?: string
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)

  useLayoutEffect(() => {
    const place = () => {
      const a = rectOf(anchor)
      const p = panel.current
      if (!a || !p) return
      const width = Math.min(380, window.innerWidth - 24)
      const middle = (a.left + a.right) / 2
      const left = Math.min(Math.max(12, middle - width / 2), window.innerWidth - width - 12)
      // Room between the header and the player bar, below and above the anchor.
      const topLimit = Math.max(8, (document.querySelector('.app-header')?.getBoundingClientRect().bottom ?? 0) + 8)
      const bottomLimit = (document.querySelector('.player')?.getBoundingClientRect().top ?? window.innerHeight) - 8
      const roomBelow = bottomLimit - (a.bottom + 8)
      const roomAbove = a.top - 8 - topLimit
      // Its full height, up to the stylesheet's cap (.note-popover: min(60vh, 420px)).
      const natural = Math.min(p.scrollHeight + 2, window.innerHeight * 0.6, 420)
      const below = natural <= roomBelow || (natural > roomAbove && roomBelow >= roomAbove)
      const maxHeight = Math.max(120, below ? roomBelow : roomAbove)
      const height = Math.min(natural, maxHeight)
      const top = below ? a.bottom + 8 : a.top - 8 - height
      setPosition({ top, left, width, maxHeight })
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
  }, [anchor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (panel.current?.contains(target)) return
      if (anchor instanceof HTMLElement && anchor.contains(target)) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [anchor, onClose])

  return createPortal(
    <div
      ref={panel}
      className={`note-popover${className ? ` ${className}` : ''}`}
      role="dialog"
      aria-label={label}
      style={position ? { top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight } : { visibility: 'hidden' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}
