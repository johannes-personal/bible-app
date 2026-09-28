import type { Translation } from './api'
import { matchesLanguage } from './lang'
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
  language: string
  label: string
  translations: Translation[]
}

export function languageLabel(t: Translation): string {
  const english = t.languageEnglishName || t.language
  const native = t.languageName
  return native && native !== english ? `${english} · ${native}` : english
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
    let g = byLang.get(t.language)
    if (!g) {
      g = { language: t.language, label: languageLabel(t), translations: [] }
      byLang.set(t.language, g)
    }
    g.translations.push(t)
  }

  const priority = [...preferred, 'en', 'sv']
  const rank = (g: LanguageGroup) => {
    const i = priority.findIndex((p) => matchesLanguage(g.language, p))
    return i === -1 ? priority.length : i
  }

  const groups = [...byLang.values()]
  for (const g of groups) g.translations.sort((a, b) => a.name.localeCompare(b.name))
  return groups.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label))
}
