import type { Translation } from './api'
import { languageKey, languageNames, matchesLanguage } from './lang'
import { load, save } from './storage'

const RECENT_KEY = 'bible:recentTranslations'

export function recentTranslationIds(): string[] {
  return load<string[]>(RECENT_KEY, [])
}

export function rememberTranslation(id: string) {
  const recent = recentTranslationIds().filter((r) => r !== id)
  save(RECENT_KEY, [id, ...recent].slice(0, 5))
}

export interface LanguageGroup {
  /** Language key shared by both sources, e.g. "sv" (see `languageKey`). */
  language: string
  label: string
  translations: Translation[]
}

/** "Swedish · svenska": the browser's names for the language, else the source's own names. */
export function languageLabel(t: Translation): string {
  const names = languageNames(languageKey(t.language))
  const english = names.english || t.languageEnglishName || t.language
  const native = names.native || t.languageName
  return native && native.toLowerCase() !== english.toLowerCase() ? `${english} · ${native}` : english
}

/**
 * Groups translations by language. Languages the browser prefers come first,
 * then English and Swedish, then the rest alphabetically.
 */
export function groupTranslations(
  translations: Translation[],
  preferred: string[],
  query = '',
): LanguageGroup[] {
  const q = query.trim().toLowerCase()
  const matches = (t: Translation) =>
    !q ||
    [t.name, t.englishName, t.shortName, t.id, t.languageName, t.languageEnglishName, t.language]
      .filter(Boolean)
      .some((s) => s!.toLowerCase().includes(q))

  const byLang = new Map<string, LanguageGroup>()
  for (const t of translations) {
    if (!matches(t)) continue
    const key = languageKey(t.language)
    let g = byLang.get(key)
    if (!g) {
      g = { language: key, label: languageLabel(t), translations: [] }
      byLang.set(key, g)
    }
    g.translations.push(t)
  }

  const rank = languageRank(preferred)
  const groups = [...byLang.values()]
  for (const g of groups) g.translations.sort((a, b) => a.name.localeCompare(b.name))
  return groups.sort((a, b) => rank(a.language) - rank(b.language) || a.label.localeCompare(b.label))
}

/** Position of a language in the preferred order (browser languages, English, Swedish); Infinity if absent. */
function languageRank(preferred: string[]) {
  const priority = [...preferred, 'en', 'sv']
  return (language: string) => {
    const i = priority.findIndex((p) => matchesLanguage(language, p))
    return i === -1 ? Infinity : i
  }
}

/**
 * Splits language groups into suggested ones (preferred languages plus the current
 * translation's language) and all the others, keeping the order of `groups`.
 */
export function partitionLanguages(groups: LanguageGroup[], preferred: string[], current?: string) {
  const rank = languageRank(preferred)
  const isSuggested = (g: LanguageGroup) => g.language === current || rank(g.language) !== Infinity
  return { suggested: groups.filter(isSuggested), others: groups.filter((g) => !isSuggested(g)) }
}
