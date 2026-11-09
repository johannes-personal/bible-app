import type { ReactNode } from 'react'

/** Marks each phrase where it occurs as a whole word, ignoring case. */
export function highlightText(text: string, phrases: string[]): ReactNode[] {
  const unique = [...new Set(phrases.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!unique.length) return [text]
  const escaped = unique.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'))
  const re = new RegExp(`(?<![\\p{L}])(${escaped.join('|')})(?![\\p{L}])`, 'giu')
  const out: ReactNode[] = []
  let at = 0
  for (const m of text.matchAll(re)) {
    out.push(text.slice(at, m.index))
    out.push(<mark key={m.index}>{m[0]}</mark>)
    at = (m.index ?? 0) + m[0].length
  }
  out.push(text.slice(at))
  return out
}
