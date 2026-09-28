import { useEffect, useState } from 'react'

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

/** Speech synthesis voices; most browsers load them asynchronously. */
export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    speechSupported ? speechSynthesis.getVoices() : [],
  )
  useEffect(() => {
    if (!speechSupported) return
    const update = () => setVoices(speechSynthesis.getVoices())
    update()
    speechSynthesis.addEventListener('voiceschanged', update)
    return () => speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])
  return voices
}

const QUALITY = /natural|neural|enhanced|premium|online|google/i

/** Voices for a BCP 47 language, best-sounding first. */
export function voicesFor(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice[] {
  const primary = lang.toLowerCase().split('-')[0]
  const userRegion = navigator.language.toLowerCase()
  const score = (v: SpeechSynthesisVoice) =>
    (QUALITY.test(v.name) ? 4 : 0) +
    (v.lang.toLowerCase().replace('_', '-') === userRegion ? 2 : 0) +
    (v.default ? 1 : 0)
  return voices
    .filter((v) => v.lang.toLowerCase().replace('_', '-').split('-')[0] === primary)
    .sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
}
