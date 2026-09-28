// The API tags translations with ISO 639-3 codes ("eng", "swe"); speech
// synthesis voices use BCP 47 tags ("en-US", "sv-SE"). This maps the
// languages that devices commonly ship voices for.
const ISO3_TO_BCP47: Record<string, string> = {
  afr: 'af', amh: 'am', ara: 'ar', arb: 'ar', aze: 'az', bel: 'be', ben: 'bn',
  bos: 'bs', bul: 'bg', cat: 'ca', ces: 'cs', cmn: 'zh', cym: 'cy', dan: 'da',
  deu: 'de', ell: 'el', eng: 'en', epo: 'eo', est: 'et', eus: 'eu', fas: 'fa',
  fin: 'fi', fra: 'fr', gle: 'ga', glg: 'gl', guj: 'gu', hat: 'ht', hau: 'ha',
  heb: 'he', hin: 'hi', hrv: 'hr', hun: 'hu', hye: 'hy', ibo: 'ig', ind: 'id',
  isl: 'is', ita: 'it', jpn: 'ja', kan: 'kn', kat: 'ka', kaz: 'kk', khm: 'km',
  kor: 'ko', lao: 'lo', lav: 'lv', lit: 'lt', mal: 'ml', mar: 'mr', mkd: 'mk',
  mlg: 'mg', mon: 'mn', msa: 'ms', mya: 'my', nep: 'ne', nld: 'nl', nob: 'nb',
  nor: 'no', npi: 'ne', pan: 'pa', pes: 'fa', plt: 'mg', pol: 'pl', por: 'pt',
  ron: 'ro', rus: 'ru', sin: 'si', slk: 'sk', slv: 'sl', som: 'so', spa: 'es',
  sqi: 'sq', srp: 'sr', swa: 'sw', swe: 'sv', swh: 'sw', tam: 'ta', tel: 'te',
  tgl: 'fil', tha: 'th', tir: 'ti', tur: 'tr', ukr: 'uk', urd: 'ur', uzb: 'uz',
  vie: 'vi', xho: 'xh', yor: 'yo', yue: 'zh-HK', zho: 'zh', zsm: 'ms', zul: 'zu',
}

/**
 * BCP 47 tag for a language code from either source: the Free Use Bible API uses
 * ISO 639-3 ("swe"), YouVersion uses BCP 47 ("sv", "zh-Hant"). Undefined if unknown.
 */
export function toBcp47(code: string): string | undefined {
  if (ISO3_TO_BCP47[code]) return ISO3_TO_BCP47[code]
  try {
    // Canonicalization also maps ISO 639-3 aliases to their 2-letter form ("swe" -> "sv").
    return Intl.getCanonicalLocales(code)[0]
  } catch {
    return undefined
  }
}

/** Primary language subtag used to group translations from both sources, e.g. "sv". */
export function languageKey(code: string): string {
  return (toBcp47(code) ?? code).toLowerCase().split('-')[0]
}

const englishNames = safeDisplayNames('en')

function safeDisplayNames(locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' })
  } catch {
    return undefined
  }
}

const nameCache = new Map<string, { english?: string; native?: string }>()

/** English and native names for a language key, e.g. { english: "Swedish", native: "svenska" }. */
export function languageNames(key: string): { english?: string; native?: string } {
  let names = nameCache.get(key)
  if (!names) {
    let english: string | undefined
    let native: string | undefined
    try {
      english = englishNames?.of(key) || undefined
      native = safeDisplayNames(key)?.of(key) || undefined
    } catch {
      // Not a valid language code; callers fall back to other names.
    }
    names = { english, native }
    nameCache.set(key, names)
  }
  return names
}

/** Primary subtags of the browser's preferred languages, e.g. ["sv", "en"]. */
export function preferredLanguages(): string[] {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  return [...new Set(langs.filter(Boolean).map((l) => l.toLowerCase().split('-')[0]))]
}

/** Whether a translation's language code matches a BCP 47 primary subtag. */
export function matchesLanguage(code: string, primary: string): boolean {
  return languageKey(code) === primary
}
