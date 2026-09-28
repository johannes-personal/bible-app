import type { Translation } from '../api'
import { languageKey } from '../lang'
import { yvTranslation, type YvBible } from './api'

// Merges the Free Use Bible API and YouVersion catalogues into one list. A translation both
// sources carry becomes a single entry: it keeps the Free Use Bible API id (so its text,
// recorded narration and existing links still work) but shows YouVersion's name and
// abbreviation, which match bible.com.

/** Pairs whose names and abbreviations differ between the sources. */
const KNOWN_PAIRS: Record<string, number> = {
  swe_svk: 1111, // Svenska Kärnbibeln: "SVK" vs "SKB"
}

const abbreviation = (s: string | undefined) => (s ?? '').toUpperCase().replace(/[^\p{L}\p{N}]/gu, '')

const title = (s: string | undefined) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

type Rule = (y: YvBible, h: Translation) => boolean

const RULES: Rule[] = [
  (y, h) => KNOWN_PAIRS[h.id] === y.id,
  (y, h) => {
    const a = abbreviation(h.shortName)
    return !!a && (a === abbreviation(y.abbreviation) || a === abbreviation(y.localized_abbreviation))
  },
  (y, h) => {
    const names = [title(h.name), title(h.englishName)].filter(Boolean)
    return names.includes(title(y.title)) || names.includes(title(y.localized_title))
  },
]

export function mergeCatalogs(free: Translation[], yv: YvBible[]): Translation[] {
  const byLanguage = new Map<string, Translation[]>()
  for (const t of free) {
    const key = languageKey(t.language)
    byLanguage.set(key, [...(byLanguage.get(key) ?? []), t])
  }

  const pairs = new Map<string, YvBible>() // Free Use Bible API id -> YouVersion Bible
  const paired = new Set<number>()
  // Stricter rules first; a rule only pairs when exactly one candidate matches, so an
  // ambiguous name never picks an arbitrary edition.
  for (const rule of RULES) {
    for (const y of yv) {
      if (paired.has(y.id)) continue
      const candidates = (byLanguage.get(languageKey(y.language_tag)) ?? []).filter(
        (h) => !pairs.has(h.id) && rule(y, h),
      )
      if (candidates.length === 1) {
        pairs.set(candidates[0].id, y)
        paired.add(y.id)
      }
    }
  }

  const merged = free.map((t): Translation => {
    const y = pairs.get(t.id)
    if (!y) return t
    return {
      ...t,
      name: y.localized_title || y.title || t.name,
      shortName: y.localized_abbreviation || y.abbreviation || t.shortName,
      youVersionId: y.id,
    }
  })
  return [...merged, ...yv.filter((y) => !paired.has(y.id)).map((y) => yvTranslation(y))]
}
