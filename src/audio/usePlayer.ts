import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChapterData } from '../api'
import { toBcp47 } from '../lang'
import type { Settings } from '../settings'
import { NarrationEngine, SpeechEngine, type Engine, type PlaybackState } from './engines'
import { speechSupported, useVoices, voicesFor } from './voices'

export interface Source {
  id: string // narrator name, or "tts"
  label: string
}

interface Options {
  chapter: ChapterData | null
  /** Plain text per verse, in chapter order. */
  verses: string[]
  title: string
  settings: Settings
  /** Called when the chapter finishes; return true to autoplay the chapter navigated to. */
  onEnded: () => boolean
  onNext: () => void
  onPrevious: () => void
}

const IDLE: PlaybackState = { status: 'idle', progress: 0, index: -1 }

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function usePlayer({ chapter, verses, title, settings, onEnded, onNext, onPrevious }: Options) {
  const allVoices = useVoices()
  const lang = chapter ? toBcp47(chapter.translation.language) : undefined
  const voices = useMemo(() => (lang ? voicesFor(allVoices, lang) : []), [allVoices, lang])
  const voice = voices.find((v) => v.voiceURI === settings.ttsVoiceURI[lang ?? '']) ?? voices[0] ?? null

  const sources = useMemo<Source[]>(() => {
    if (!chapter) return []
    const links = chapter.thisChapterAudioLinks ?? {}
    // Only narrators with verse timings, so highlighting and autoscroll stay in sync.
    const narrators = Object.keys(chapter.thisChapterAudioTimings ?? {})
      .filter((n) => links[n])
      .map((n) => ({ id: n, label: `Narrator: ${capitalize(n)}` }))
    const tts = speechSupported && voices.length ? [{ id: 'tts', label: 'Device voice' }] : []
    return [...narrators, ...tts]
  }, [chapter, voices.length])

  const sourceId = sources.find((s) => s.id === settings.audioSource)?.id ?? sources[0]?.id ?? null

  const [state, setState] = useState<PlaybackState>(IDLE)
  const engineRef = useRef<Engine | null>(null)
  const autoplayRef = useRef(false)

  // Latest values for use inside callbacks without re-creating them.
  const latest = useRef({ chapter, verses, sourceId, voice, lang, rate: settings.rate, onEnded, state })
  useLayoutEffect(() => {
    latest.current = { chapter, verses, sourceId, voice, lang, rate: settings.rate, onEnded, state }
  })

  const ensureEngine = useCallback((): Engine | null => {
    if (engineRef.current) return engineRef.current
    const { chapter, verses, sourceId, voice, lang, rate } = latest.current
    if (!chapter || !sourceId) return null

    let engine: Engine | null = null
    const callbacks = {
      onUpdate: (patch: Partial<PlaybackState>) => {
        if (engineRef.current === engine) setState((s) => ({ ...s, ...patch }))
      },
      onEnded: () => {
        if (engineRef.current === engine && latest.current.onEnded()) autoplayRef.current = true
      },
    }
    engine =
      sourceId === 'tts'
        ? new SpeechEngine(verses, lang ?? 'en', voice, rate, callbacks)
        : new NarrationEngine(
            chapter.thisChapterAudioLinks[sourceId],
            chapter.thisChapterAudioTimings[sourceId],
            rate,
            callbacks,
          )
    engineRef.current = engine
    return engine
  }, [])

  const play = useCallback((fromIndex?: number) => ensureEngine()?.play(fromIndex), [ensureEngine])
  const pause = useCallback(() => engineRef.current?.pause(), [])
  const toggle = useCallback(() => {
    const { status } = latest.current.state
    if (status === 'playing' || status === 'loading') pause()
    else play()
  }, [play, pause])
  const seek = useCallback((fraction: number) => {
    ensureEngine()?.seek(fraction)
    setState((s) => ({ ...s, progress: fraction }))
  }, [ensureEngine])

  // Swap engines when the chapter, source or voice changes.
  const chapterKey = chapter ? `${chapter.translation.id}/${chapter.book.id}/${chapter.chapter.number}` : ''
  const engineKey = `${chapterKey}|${sourceId}|${voice?.voiceURI ?? ''}`
  const prevChapterKey = useRef(chapterKey)
  useEffect(() => {
    const prev = latest.current.state
    const wasPlaying = prev.status === 'playing' || prev.status === 'loading'
    const sameChapter = prevChapterKey.current === chapterKey
    prevChapterKey.current = chapterKey

    engineRef.current?.destroy()
    engineRef.current = null
    // Resetting alongside the engine teardown keeps the two in step.
    // oxlint-disable-next-line react/set-state-in-effect
    setState(IDLE)

    if (!chapterKey) return
    if (sameChapter && wasPlaying) {
      play(Math.max(prev.index, 0)) // switched voice mid-chapter: carry on from the same verse
    } else if (!sameChapter && autoplayRef.current) {
      autoplayRef.current = false
      play(0)
    }
  }, [engineKey, chapterKey, play])

  useEffect(() => engineRef.current?.setRate(settings.rate), [settings.rate])

  useEffect(
    () => () => {
      engineRef.current?.destroy()
      engineRef.current = null
    },
    [],
  )

  // Lock screen / headset controls.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    ms.metadata = new MediaMetadata({ title, artist: chapter?.translation.name ?? '', album: 'Bible' })
    const actions: [MediaSessionAction, () => void][] = [
      ['play', () => play()],
      ['pause', pause],
      ['nexttrack', onNext],
      ['previoustrack', onPrevious],
    ]
    for (const [a, h] of actions) {
      try {
        ms.setActionHandler(a, h)
      } catch {
        // Unsupported action on this browser.
      }
    }
  }, [title, chapter, play, pause, onNext, onPrevious])

  return { sources, sourceId, voices, voice, lang, state, play, pause, toggle, seek }
}

export type Player = ReturnType<typeof usePlayer>
