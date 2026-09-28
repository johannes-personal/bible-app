import { useCallback, useEffect, useState } from 'react'
import { load, save } from './storage'

export type Theme = 'auto' | 'light' | 'sepia' | 'dark'

export interface Settings {
  theme: Theme
  fontSize: number // px
  redLetters: boolean
  showVerseNumbers: boolean
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
  redLetters: false,
  showVerseNumbers: true,
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

  useEffect(() => save(KEY, settings), [settings])

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.theme
    root.style.setProperty('--reader-size', `${settings.fontSize}px`)
  }, [settings.theme, settings.fontSize])

  const update = useCallback(
    (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })),
    [],
  )
  return [settings, update] as const
}

export type UpdateSettings = ReturnType<typeof useSettings>[1]
