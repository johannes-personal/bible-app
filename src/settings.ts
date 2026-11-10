import { useCallback, useEffect, useState } from 'react'
import { load, save } from './storage'

export type Theme = 'auto' | 'light' | 'sepia' | 'dark'

export type ReaderFont = 'literata' | 'garamond' | 'sans' | 'legible'

/** The reader's typefaces. Literata ships with the page; the others load when first chosen. */
/** `scale` evens out how large each face looks at the same size. */
export const FONTS: { id: ReaderFont; label: string; family: string; scale: number; googleFamily?: string }[] = [
  { id: 'literata', label: 'Serif', family: "'Literata', 'Iowan Old Style', Georgia, serif", scale: 1 },
  {
    id: 'garamond',
    label: 'Classic',
    family: "'EB Garamond', Garamond, 'Times New Roman', serif",
    scale: 1.12,
    googleFamily: 'EB+Garamond:ital,wght@0,400..700;1,400..700',
  },
  {
    id: 'sans',
    label: 'Sans-serif',
    family: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    scale: 0.94,
    googleFamily: 'Inter:ital,opsz,wght@0,14..32,400..700;1,14..32,400..700',
  },
  {
    id: 'legible',
    label: 'Legible',
    family: "'Atkinson Hyperlegible Next', 'Atkinson Hyperlegible', system-ui, sans-serif",
    scale: 0.98,
    googleFamily: 'Atkinson+Hyperlegible+Next:ital,wght@0,400..700;1,400..700',
  },
]

export interface Settings {
  theme: Theme
  fontSize: number // px
  font: ReaderFont
  redLetters: boolean
  showVerseNumbers: boolean
  /** Mark verses with strong cross references (OpenBible.info). */
  relatedVerses: boolean
  /** Pressing and holding a verse opens its Hebrew or Greek words (its verse number always does). */
  longPressWords: boolean
  /** Swiping left or right on a touch screen turns the chapter. */
  swipeChapters: boolean
  /** A second translation shown beside the first, or null. */
  parallel: string | null
  // Audio
  /** "tts" for the device voice, otherwise a narrator name such as "hays". */
  audioSource: string
  ttsVoiceURI: Record<string, string> // BCP 47 language -> chosen voice
  rate: number
  autoscroll: boolean
  continueToNext: boolean
}

const KEY = 'bible:settings'

const DEFAULTS: Settings = {
  theme: 'auto',
  fontSize: 19,
  font: 'literata',
  redLetters: false,
  showVerseNumbers: true,
  relatedVerses: true,
  longPressWords: false,
  swipeChapters: true,
  parallel: null,
  audioSource: '',
  ttsVoiceURI: {},
  rate: 1,
  autoscroll: true,
  continueToNext: true,
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULTS,
    ...load<Partial<Settings>>(KEY, {}),
  }))

  useEffect(() => {
    save(KEY, settings)
  }, [settings])

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.theme
    root.style.setProperty('--reader-size', `${settings.fontSize}px`)
    const font = FONTS.find((f) => f.id === settings.font) ?? FONTS[0]
    loadFont(font)
    root.style.setProperty('--reader-font', font.family)
    root.style.setProperty('--reader-font-scale', String(font.scale))
  }, [settings.theme, settings.fontSize, settings.font])

  const update = useCallback(
    (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })),
    [],
  )
  return [settings, update] as const
}

export type UpdateSettings = ReturnType<typeof useSettings>[1]

/** Adds the Google Fonts stylesheet for a typeface, once. */
export function loadFont(font: (typeof FONTS)[number]) {
  if (!font.googleFamily) return
  const id = `font-${font.id}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${font.googleFamily}&display=swap`
  document.head.appendChild(link)
}
