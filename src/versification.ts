// Translations don't all number verses the same way. The word study data follows the BSB
// (English numbering); the one difference worth correcting is in the Psalms, where many
// translations (including Dutch and German ones) number the psalm's title as verse 1, or
// verses 1–2, so the rest of the psalm runs one or two ahead of the BSB.

/** How far a translation's verse numbers run ahead of the BSB's in a chapter (0 if they agree). */
export function verseOffset(book: string, verseCount: number, bsbVerseCount: number): number {
  if (book !== 'PSA') return 0
  const d = verseCount - bsbVerseCount
  return d === 1 || d === 2 ? d : 0
}

/** The BSB verse for a verse of the translation (its title verses belong to the BSB's verse 1). */
export const bsbVerseOf = (verse: number, offset: number) => Math.max(1, verse - offset)

/** The translation's verses for a BSB verse (its verse 1 also covers the title verses). */
export function versesOfBsb(verse: number, offset: number): number[] {
  if (verse === 1) return Array.from({ length: offset + 1 }, (_, i) => i + 1)
  return [verse + offset]
}

/**
 * Lines a second translation's verses up with the first's, row by row. Verses are matched by
 * number, allowing for psalm titles numbered as verses in one of them; any verse of the second
 * left over (numbered differently, or combined) goes with the nearest verse before it.
 */
export function alignVerses<T>(book: string, first: number[], second: { number: number; item: T }[]): T[][] {
  const rows: T[][] = first.map(() => [])
  if (!first.length) return rows
  const firstCount = Math.max(...first)
  const secondCount = Math.max(0, ...second.map((s) => s.number))
  // How far the second's numbers run ahead of the first's (negative: behind).
  const d = secondCount - firstCount
  const shift = book === 'PSA' && d !== 0 && Math.abs(d) <= 2 ? d : 0
  const rowOf = new Map(first.map((n, i) => [n, i]))
  // The first's verse a second verse belongs with.
  const target = (n: number) => (shift > 0 ? (n <= 1 + shift ? 1 : n - shift) : n === 1 ? 1 : n - shift)
  let last = 0
  for (const s of second) {
    let row = rowOf.get(target(s.number))
    if (row == null) {
      // The nearest verse of the first numbered before it, else the row it would follow.
      const t = target(s.number)
      const earlier = first.findLastIndex((n) => n < t)
      row = earlier >= 0 ? Math.max(earlier, last) : last
    }
    rows[row].push(s.item)
    last = row
  }
  return rows
}
