import { useState, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { load, save } from '../storage'
import { formatCount } from './data'
import type { Mode } from './scope'

const COLLAPSED_KEY = 'bible:study-collapsed'

/** A dashboard card whose body can be collapsed; collapsed cards stay collapsed next time. */
export function Card({ id, title, subtitle, actions, className, children }: {
  id: string
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(() => !load<string[]>(COLLAPSED_KEY, []).includes(id))
  const toggle = () => {
    const collapsed = new Set(load<string[]>(COLLAPSED_KEY, []))
    if (open) collapsed.add(id)
    else collapsed.delete(id)
    save(COLLAPSED_KEY, [...collapsed])
    setOpen(!open)
  }
  return (
    <section className={`ws-card${open ? '' : ' collapsed'}${className ? ` ${className}` : ''}`}>
      <div className="ws-card-head">
        <button className="ws-card-toggle" aria-expanded={open} onClick={toggle}>
          <Icon name="chevronDown" />
          <h2>{title}</h2>
        </button>
        {open && actions}
      </div>
      {open && (
        <>
          {subtitle && <div className="ws-card-subtitle muted">{subtitle}</div>}
          {children}
        </>
      )}
    </section>
  )
}

export function Stats({ items }: { items: [number, string][] }) {
  return (
    <dl className="ws-stats">
      {items.map(([value, label], i) => (
        <div key={label} className={i === 0 ? 'hero' : undefined}>
          <dt>{label}</dt>
          <dd>{formatCount(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="ws-toggle" role="group" aria-label="Show as">
      <button aria-pressed={mode === 'count'} onClick={() => onChange('count')}>Times</button>
      <button
        aria-pressed={mode === 'rate'}
        onClick={() => onChange('rate')}
        title="Times per 1,000 Hebrew or Greek words, so long and short books compare fairly"
      >
        Per 1,000 words
      </button>
    </div>
  )
}

export interface RankedItem {
  key: string
  label: ReactNode
  /** Makes the label a link (e.g. to the word's own page). */
  href?: string
  value: number
  color?: string
  /** Selected as a filter. */
  active?: boolean
  /** Clicking the bar filters by this item; its accessible name says to what. */
  onSelect?: () => void
  selectLabel?: string
}

/** Ranked bars, largest first, value at the tip. The bar part filters; the label can link. */
export function RankedList({ items, unit }: { items: RankedItem[]; unit?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="ws-ranked">
      {items.map((item) => {
        const bar = (
          <span className="ws-bar-track">
            <span className="ws-bar" style={{ width: `${(item.value / max) * 100}%` }}>
              <span className="ws-seg" style={{ background: item.color }} />
            </span>
            <span className="ws-bar-value">
              {formatCount(item.value)}
              {unit && <span className="muted"> {unit}</span>}
            </span>
          </span>
        )
        return (
          <li key={item.key} className={item.active ? 'active' : undefined}>
            {item.href ? (
              <a className="ws-ranked-label" href={item.href}>{item.label}</a>
            ) : (
              <span className="ws-ranked-label">{item.label}</span>
            )}
            {item.onSelect ? (
              <button className="ws-ranked-bar" aria-pressed={!!item.active} aria-label={item.selectLabel} onClick={item.onSelect}>
                {bar}
              </button>
            ) : (
              bar
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** The first `limit` items, with a button for the rest. */
export function Folded<T>({ items, limit, render }: { items: T[]; limit: number; render: (items: T[]) => ReactNode }) {
  const [all, setAll] = useState(false)
  return (
    <>
      {render(all ? items : items.slice(0, limit))}
      {items.length > limit && (
        <button className="link ws-view-toggle" onClick={() => setAll((a) => !a)}>
          {all ? 'Show fewer' : `Show all ${items.length}`}
        </button>
      )}
    </>
  )
}

/** An active filter, with a button to clear it. */
export function FilterChip({ children, onClear }: { children: ReactNode; onClear: () => void }) {
  return (
    <span className="ws-chip">
      {children}
      <button aria-label="Clear filter" onClick={onClear}>
        <Icon name="close" />
      </button>
    </span>
  )
}
