import type { CSSProperties, ReactNode } from 'react'
import { formatCount, type Meta, type Occurrence } from './data'
import { bookScope, TESTAMENTS, type Mode, type Scope } from './scope'

// The "Where it's used" explorer: a heatmap you drill into, from the whole Bible (both
// testaments and their sections at once) to the books of a section and the chapters of a
// book. Each tile previews the level below it, so one screen shows two layers.

export interface SeriesInfo {
  key: string
  label: string
  color: string
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const formatRate = (x: number) => (x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2))

/** Accent-tinted background, stronger where the value is higher (one hue, light to dark). */
function heat(value: number, max: number, solid = false): CSSProperties | undefined {
  if (!value || !max) return undefined
  const share = Math.sqrt(value / max)
  const percent = solid ? 20 + 80 * share : 10 + 42 * share
  return { background: `color-mix(in srgb, var(--accent) ${Math.round(percent)}%, var(--surface))` }
}

export function Explorer({ meta, occurrences, mode, scope, onScope, series, seriesOf }: {
  meta: Meta
  occurrences: Occurrence[]
  mode: Mode
  scope: Scope
  onScope: (scope: Scope) => void
  /** Words to split each tile by (English pages), with the index of each occurrence's word. */
  series?: SeriesInfo[]
  seriesOf?: (o: Occurrence) => number
}) {
  // Counts per book and chapter, and per series per book.
  const chapters = meta.books.map((b) => new Array<number>(b.words.length).fill(0))
  const bySeries = meta.books.map(() => new Array<number>(series?.length ?? 0).fill(0))
  for (const o of occurrences) {
    chapters[o.book][o.chapter - 1]++
    if (series && seriesOf) bySeries[o.book][seriesOf(o)]++
  }
  const bookCount = chapters.map(sum)
  const bookWords = meta.books.map((b) => sum(b.words))
  const booksOf = (section: number) => meta.books.flatMap((b, i) => (b.section === section ? [i] : []))
  const value = (count: number, words: number) => (mode === 'rate' ? (words ? (count / words) * 1000 : 0) : count)
  const format = (v: number) => (mode === 'rate' ? formatRate(v) : formatCount(v))
  const sectionValue = (s: number) => {
    const books = booksOf(s)
    return value(sum(books.map((b) => bookCount[b])), sum(books.map((b) => bookWords[b])))
  }
  const bookValue = (b: number) => value(bookCount[b], bookWords[b])
  const chapterValue = (b: number, c: number) => value(chapters[b][c], meta.books[b].words[c])

  const split = (books: number[]) =>
    series && series.length > 1 ? (
      <SplitBar series={series} parts={series.map((_, i) => sum(books.map((b) => bySeries[b][i])))} />
    ) : null

  /** "6 times", "1 time" or "0.42 per 1,000 words", for labels and tooltips. */
  const describe = (v: number) => `${format(v)} ${mode === 'rate' ? 'per 1,000 words' : v === 1 ? 'time' : 'times'}`
  const crumbs: [string, Scope | null][] = [['Whole Bible', {}]]
  if (scope.section != null) crumbs.push([meta.sections[scope.section], { section: scope.section }])
  if (scope.book != null && booksOf(scope.section ?? -1).length > 1) crumbs.push([meta.books[scope.book].name, bookScope(meta, scope.book)])
  if (scope.chapter != null) crumbs.push([`Chapter ${scope.chapter}`, null])

  let body: ReactNode
  if (scope.book != null) {
    // Chapters of one book.
    const b = scope.book
    const max = Math.max(...chapters[b].map((_, c) => chapterValue(b, c)))
    body = (
      <div className="ws-chapters">
        {chapters[b].map((n, c) => (
          <button
            key={c}
            className={`ws-chapter${n ? '' : ' zero'}${scope.chapter === c + 1 ? ' selected' : ''}`}
            style={heat(chapterValue(b, c), max)}
            aria-pressed={scope.chapter === c + 1}
            aria-label={`Chapter ${c + 1}: ${describe(chapterValue(b, c))}`}
            onClick={() => onScope(scope.chapter === c + 1 ? bookScope(meta, b) : { ...bookScope(meta, b), chapter: c + 1 })}
          >
            <span className="ws-chapter-number">{c + 1}</span>
            <span className="ws-chapter-value">{n ? format(chapterValue(b, c)) : ''}</span>
          </button>
        ))}
      </div>
    )
  } else if (scope.section != null) {
    // Books of one section, each previewing its chapters.
    const books = booksOf(scope.section)
    const max = Math.max(...books.map(bookValue))
    const maxChapter = Math.max(...books.flatMap((b) => chapters[b].map((_, c) => chapterValue(b, c))))
    body = (
      <div className="ws-tiles">
        {books.map((b) => (
          <Tile
            key={b}
            name={meta.books[b].name}
            value={bookValue(b)}
            max={max}
            format={format}
            describe={describe}
            onClick={() => onScope(bookScope(meta, b))}
          >
            <span className="ws-cells">
              {chapters[b].map((_, c) => (
                <span key={c} className="ws-mini" style={heat(chapterValue(b, c), maxChapter, true)} />
              ))}
            </span>
            {split([b])}
          </Tile>
        ))}
      </div>
    )
  } else {
    // Both testaments with their sections, each previewing its books.
    const allSections = TESTAMENTS.flatMap((t) => t.sections)
    const max = Math.max(...allSections.map(sectionValue))
    const maxBook = Math.max(...meta.books.map((_, b) => bookValue(b)))
    body = (
      <div className="ws-testaments">
        {TESTAMENTS.map((t) => {
          const books = t.sections.flatMap(booksOf)
          return (
            <div key={t.name} className="ws-testament">
              <div className="ws-testament-head">
                <span>{t.name}</span>
                <span className="ws-testament-value">
                  {format(value(sum(books.map((b) => bookCount[b])), sum(books.map((b) => bookWords[b]))))}
                </span>
              </div>
              {!books.some((b) => bookCount[b]) ? (
                <p className="ws-unused muted">Not used in the {t.name}.</p>
              ) : (
                <div className="ws-tiles">
                  {t.sections.map((s) => {
                    const sectionBooks = booksOf(s)
                    return (
                      <Tile
                        key={s}
                        name={meta.sections[s]}
                        value={sectionValue(s)}
                        max={max}
                        format={format}
                        describe={describe}
                        onClick={() => onScope(sectionBooks.length === 1 ? bookScope(meta, sectionBooks[0]) : { section: s })}
                      >
                        <span className="ws-cells">
                          {sectionBooks.map((b) => (
                            <span
                              key={b}
                              className="ws-mini"
                              title={`${meta.books[b].name}: ${describe(bookValue(b))}`}
                              style={heat(bookValue(b), maxBook, true)}
                            />
                          ))}
                        </span>
                        {split(sectionBooks)}
                      </Tile>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="ws-explorer">
      <nav className="ws-crumbs" aria-label="Part of the Bible">
        {crumbs.map(([label, target], i) => (
          <span key={i}>
            {i > 0 && <span className="ws-crumb-sep" aria-hidden="true">›</span>}
            {target && i < crumbs.length - 1 ? (
              <button className="link" onClick={() => onScope(target)}>{label}</button>
            ) : (
              <span aria-current="location">{label}</span>
            )}
          </span>
        ))}
      </nav>
      {series && series.length > 1 && (
        <ul className="ws-legend">
          {series.map((s) => (
            <li key={s.key}>
              <span className="ws-swatch" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {body}
    </div>
  )
}

function Tile({ name, value, max, format, describe, onClick, children }: {
  name: string
  value: number
  max: number
  format: (v: number) => string
  describe: (v: number) => string
  onClick: () => void
  children?: ReactNode
}) {
  return (
    <button
      className={`ws-tile${value ? '' : ' zero'}`}
      style={heat(value, max)}
      onClick={onClick}
      aria-label={`${name}: ${describe(value)}`}
    >
      <span className="ws-tile-name">{name}</span>
      <span className="ws-tile-value">{format(value)}</span>
      {children}
    </button>
  )
}

/** A thin bar split by word, for English pages (the legend names the colours). */
function SplitBar({ series, parts }: { series: SeriesInfo[]; parts: number[] }) {
  if (!sum(parts)) return null
  return (
    <span className="ws-split" aria-hidden="true">
      {parts.map((p, i) => (p ? <span key={series[i].key} style={{ flexGrow: p, background: series[i].color }} /> : null))}
    </span>
  )
}
