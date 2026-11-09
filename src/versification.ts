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
