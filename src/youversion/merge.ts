import type { Translation } from '../api'
import { languageKey } from '../lang'
import { yvTranslation, type YvBible } from './api'

// Merges the YouVersion and Free Use Bible API catalogues into one list. YouVersion comes
// first: a translation both sources carry becomes a YouVersion entry (id "yv-…", name and
// abbreviation as on bible.com) that remembers its Free Use Bible API id in `freeId`, for
// recorded narration and as a fallback when YouVersion can't be reached. Translations only
// the Free Use Bible API has are added after with their own ids.

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

  const freeById = new Map(free.map((t) => [t.id, t]))
  const freeIdOf = new Map([...pairs].map(([freeId, y]) => [y.id, freeId]))
  const fromYv = yv.map((y): Translation => {
    const t = freeById.get(freeIdOf.get(y.id) ?? '')
    const entry = yvTranslation(y)
    if (!t) return entry
    return {
      ...entry,
      // The Free Use Bible API's language names and text direction are kept as labels.
      languageName: t.languageName,
      languageEnglishName: t.languageEnglishName,
      textDirection: t.textDirection,
      numberOfBooks: entry.numberOfBooks || t.numberOfBooks,
      freeId: t.id,
    }
  })
  return [...fromYv, ...free.filter((t) => !pairs.has(t.id))]
}
