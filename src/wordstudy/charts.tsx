import { useState, type ReactNode } from 'react'
import { formatCount, type Meta } from './data'

// Small hand-drawn charts for the word study pages: bars per book (optionally stacked by
// Hebrew/Greek word), a book × chapter map, and ranked bars.

export type Mode = 'count' | 'rate'

export interface Series {
  key: string
  label: string
  /** CSS colour (a palette variable); single-series charts use the accent. */
  color: string
  /** Occurrences per chapter, by book index. */
  chapters: Map<number, number[]>
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const formatRate = (x: number) => (x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2))

/** Book totals per series, and per 1,000 original-language words when `mode` is "rate". */
function bookValues(meta: Meta, series: Series[], mode: Mode) {
  return meta.books.map((book, b) => {
    const words = sum(book.words)
    const parts = series.map((s) => {
      const count = sum(s.chapters.get(b) ?? [])
      return mode === 'rate' ? (count / words) * 1000 : count
    })
    return { book: b, parts, total: sum(parts) }
  })
}

interface Tip {
  x: number
  y: number
  content: ReactNode
}

/** One floating tooltip per chart, following the pointer. */
function useTooltip() {
  const [tip, setTip] = useState<Tip | null>(null)
  const show = (e: React.PointerEvent | React.FocusEvent, content: ReactNode) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = 'clientX' in e ? e.clientX : rect.left + rect.width / 2
    setTip({ x, y: rect.top, content })
  }
  const hide = () => setTip(null)
  const node = tip && (
    <div className="ws-tooltip" role="status" style={{ left: tip.x, top: tip.y }}>
      {tip.content}
    </div>
  )
  return { show, hide, node }
}

/**
 * Bars per book, grouped by section; only books where the word occurs. With several series
 * the bars are stacked, with a legend and a table view.
 */
export function BookChart({ meta, series, mode, onBook }: {
  meta: Meta
  series: Series[]
  mode: Mode
  onBook?: (book: number) => void
}) {
  const tooltip = useTooltip()
  const [table, setTable] = useState(false)
  const rows = bookValues(meta, series, mode).filter((r) => r.total > 0)
  const max = Math.max(...rows.map((r) => r.total), 0)
  const format = mode === 'rate' ? formatRate : formatCount
  const stacked = series.length > 1

  if (!rows.length) return <p className="muted">No occurrences.</p>

  const legend = stacked && (
    <ul className="ws-legend">
      {series.map((s) => (
        <li key={s.key}>
          <span className="ws-swatch" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  )

  if (table) {
    return (
      <>
        {legend}
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Book</th>
                {stacked && series.map((s) => <th key={s.key}>{s.label}</th>)}
                <th>{mode === 'rate' ? 'Per 1,000 words' : 'Total'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.book}>
                  <td>{meta.books[r.book].name}</td>
                  {stacked && r.parts.map((p, i) => <td key={i}>{p ? format(p) : ''}</td>)}
                  <td>{format(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="link ws-view-toggle" onClick={() => setTable(false)}>Show as chart</button>
      </>
    )
  }

  return (
    <>
      {legend}
      <div className="ws-bars" onPointerLeave={tooltip.hide}>
        {rows.map((r, i) => {
          const book = meta.books[r.book]
          const header = i === 0 || meta.books[rows[i - 1].book].section !== book.section
          const sectionTotal = header
            ? sum(rows.filter((x) => meta.books[x.book].section === book.section).map((x) => x.total))
            : 0
          return (
            <div key={r.book} className="ws-bar-group">
              {header && (
                <div className="ws-section">
                  <span>{meta.sections[book.section]}</span>
                  <span className="ws-section-total">{mode === 'count' && formatCount(sectionTotal)}</span>
                </div>
              )}
              <button
                className="ws-bar-row"
                onClick={onBook && (() => onBook(r.book))}
                aria-label={`${book.name}: ${format(r.total)}${mode === 'rate' ? ' per 1,000 words' : ''}`}
                onPointerMove={(e) =>
                  tooltip.show(
                    e,
                    <>
                      <strong>{format(r.total)}</strong> {book.name}
                      {stacked &&
                        series.map((s, i) =>
                          r.parts[i] ? (
                            <span key={s.key} className="ws-tip-row">
                              <span className="ws-tip-key" style={{ background: s.color }} />
                              <strong>{format(r.parts[i])}</strong> {s.label}
                            </span>
                          ) : null,
                        )}
                    </>,
                  )
                }
              >
                <span className="ws-bar-label">{book.name}</span>
                <span className="ws-bar-track">
                  <span className="ws-bar" style={{ width: `${(r.total / max) * 100}%` }}>
                    {series.map((s, i) =>
                      r.parts[i] ? (
                        <span key={s.key} className="ws-seg" style={{ flexGrow: r.parts[i], background: s.color }} />
                      ) : null,
                    )}
                  </span>
                  <span className="ws-bar-value">{format(r.total)}</span>
                </span>
              </button>
            </div>
          )
        })}
      </div>
      {tooltip.node}
      <button className="link ws-view-toggle" onClick={() => setTable(true)}>Show as table</button>
    </>
  )
}

/**
 * The whole Bible as rows of chapters, one row per book; darker where the word is used
 * more. Shows at a glance where it clusters.
 */
export function BibleMap({ meta, counts, onChapter }: {
  meta: Meta
  counts: Map<number, number[]>
  onChapter?: (book: number, chapter: number) => void
}) {
  const tooltip = useTooltip()
  let max = 0
  for (const cs of counts.values()) for (const c of cs) max = Math.max(max, c)
  return (
    <div className="ws-map" onPointerLeave={tooltip.hide}>
      {meta.books.map((book, b) => {
        const cs = counts.get(b)
        return (
          <div key={book.id} className={`ws-map-row${book.section !== meta.books[b - 1]?.section ? ' new-section' : ''}`}>
            <span className="ws-map-label" title={book.name}>{book.id}</span>
            <span className="ws-map-cells">
              {book.words.map((_, c) => {
                const n = cs?.[c] ?? 0
                return (
                  <span
                    key={c}
                    className={`ws-cell${n ? ' on' : ''}`}
                    style={n ? { opacity: 0.35 + 0.65 * Math.sqrt(n / max) } : undefined}
                    onPointerMove={(e) =>
                      tooltip.show(e, (
                        <>
                          <strong>{n}</strong> {book.name} {c + 1}
                        </>
                      ))
                    }
                    onClick={n && onChapter ? () => onChapter(b, c + 1) : undefined}
                  />
                )
              })}
            </span>
          </div>
        )
      })}
      <div className="ws-map-scale" aria-hidden="true">
        <span>Fewer</span>
        <span className="ws-map-ramp" />
        <span>More</span>
      </div>
      {tooltip.node}
    </div>
  )
}

export interface RankedItem {
  key: string
  label: ReactNode
  value: number
  href?: string
  color?: string
}

/** Ranked horizontal bars, largest first, with the value at the tip. */
export function RankedBars({ items, unit }: { items: RankedItem[]; unit?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="ws-ranked">
      {items.map((item) => {
        const body = (
          <>
            <span className="ws-ranked-label">{item.label}</span>
            <span className="ws-bar-track">
              <span className="ws-bar" style={{ width: `${(item.value / max) * 100}%` }}>
                <span className="ws-seg" style={{ flexGrow: 1, background: item.color }} />
              </span>
              <span className="ws-bar-value">
                {formatCount(item.value)}
                {unit && <span className="muted"> {unit}</span>}
              </span>
            </span>
          </>
        )
        return (
          <li key={item.key}>
            {item.href ? <a className="ws-ranked-row" href={item.href}>{body}</a> : <div className="ws-ranked-row">{body}</div>}
          </li>
        )
      })}
    </ul>
  )
}
