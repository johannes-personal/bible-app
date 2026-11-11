import { load, save } from '../storage'

// What the reader has saved on this device for reading without a connection. Only the record is
// here; the text itself is in the browser's cache storage, which the service worker reads from.

/** The cache the service worker answers from: keep the name in step with pwa/sw.js. */
export const DATA_CACHE = 'bible-data-v1'
export const FREE_API = 'https://bible.helloao.org'

const KEY = 'bible:offline'

export interface SavedTranslation {
  /** Short name, for lists. */
  name: string
  savedAt: number
  /** The id it's read under, when that isn't its Free Use Bible API id (e.g. "yv-3034" for the BSB). */
  alias?: string
}

export interface Saved {
  /** By Free Use Bible API id. */
  translations: Record<string, SavedTranslation>
  wordStudy?: { savedAt: number }
}

export const loadSaved = (): Saved => ({ translations: {}, ...load<Partial<Saved>>(KEY, {}) })
export const storeSaved = (saved: Saved) => save(KEY, saved)

/**
 * The Free Use Bible API id of a saved translation, from the id it's read under. Offline the
 * catalogue can't say that "yv-3034" is the BSB, so the saved record does.
 */
export function savedFreeId(translationId: string): string | undefined {
  const { translations } = loadSaved()
  if (translations[translationId]) return translationId
  return Object.keys(translations).find((id) => translations[id].alias === translationId)
}
