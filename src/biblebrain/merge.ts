import type { Translation } from '../api'
import { languageKey } from '../lang'
import { bbTranslation, hasAudio, hasTextAndAudio, shortNameOf, type BbBible } from './api'

// Adds Bible Brain to the merged catalogue. A Bible Brain recording of a translation the app
// already has is attached to that entry (`bibleBrainId`), so it can be played along with the
// text. Bible Brain Bibles with both text and narration that match nothing are added as
// translations of their own ("bb-…"). Text-only ones are left out: they'd mostly duplicate
// what the other sources already carry, under slightly different names.

/** Matches the name rules don't find; keyed by translation id or Free Use Bible API id. */
const KNOWN_PAIRS: Record<string, string> = {
  swe_fol: 'SWESFB', // Svenska Folkbibeln (1998)
  eng_kjv: 'ENGKJV',
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

type Rule = (b: BbBible, t: Translation) => boolean

const RULES: Rule[] = [
  (b, t) => KNOWN_PAIRS[t.id] === b.id || (!!t.freeId && KNOWN_PAIRS[t.freeId] === b.id),
  (b, t) => {
    const a = abbreviation(t.shortName)
    return !!a && a === abbreviation(shortNameOf(b))
  },
  (b, t) => {
    const names = [title(t.name), title(t.englishName)].filter(Boolean)
    return names.includes(title(b.name)) || (!!b.vname && names.includes(title(b.vname)))
  },
]

export function addBibleBrain(translations: Translation[], bb: BbBible[]): Translation[] {
  const byLanguage = new Map<string, Translation[]>()
  for (const t of translations) {
    const key = languageKey(t.language)
    byLanguage.set(key, [...(byLanguage.get(key) ?? []), t])
  }

  const pairs = new Map<string, BbBible>() // translation id -> Bible Brain Bible
  const paired = new Set<string>()
  // Stricter rules first; a rule only pairs when exactly one candidate matches.
  for (const rule of RULES) {
    for (const b of bb) {
      if (paired.has(b.id)) continue
      const candidates = (byLanguage.get(languageKey(b.iso)) ?? []).filter((t) => !pairs.has(t.id) && rule(b, t))
      if (candidates.length === 1) {
        pairs.set(candidates[0].id, b)
        paired.add(b.id)
      }
    }
  }

  const withAudio = translations.map((t): Translation => {
    const b = pairs.get(t.id)
    return b && hasAudio(b) ? { ...t, bibleBrainId: b.id } : t
  })
  const own = bb.filter((b) => !paired.has(b.id) && hasTextAndAudio(b)).map((b) => bbTranslation(b))
  return [...withAudio, ...own]
}
