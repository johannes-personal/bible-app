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

export function toBcp47(iso3: string): string | undefined {
  return ISO3_TO_BCP47[iso3]
}

/** Primary subtags of the browser's preferred languages, e.g. ["sv", "en"]. */
export function preferredLanguages(): string[] {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  return [...new Set(langs.filter(Boolean).map((l) => l.toLowerCase().split('-')[0]))]
}

/** Whether a translation's ISO 639-3 language matches a BCP 47 primary subtag. */
export function matchesLanguage(iso3: string, primary: string): boolean {
  return toBcp47(iso3)?.split('-')[0] === primary
}
