/** Splits text into stretches, marking each phrase where it occurs as a whole word, ignoring case. */
export function splitMarked(text: string, phrases: string[]): { text: string; marked: boolean }[] {
  const unique = [...new Set(phrases.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (!unique.length) return [{ text, marked: false }]
  const escaped = unique.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'))
  const re = new RegExp(`(?<![\\p{L}])(${escaped.join('|')})(?![\\p{L}])`, 'giu')
  const out: { text: string; marked: boolean }[] = []
  let at = 0
  for (const m of text.matchAll(re)) {
    if (m.index > at) out.push({ text: text.slice(at, m.index), marked: false })
    out.push({ text: m[0], marked: true })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ text: text.slice(at), marked: false })
  return out
}
