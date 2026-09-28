// Two interchangeable playback engines behind one interface:
//  - NarrationEngine plays a recorded mp3 and uses per-verse timings to know the current verse.
//  - SpeechEngine reads verse text with the browser's speech synthesis.

import { fetchAudioTimings } from '../api'

export type Status = 'idle' | 'loading' | 'playing' | 'paused'

export interface PlaybackState {
  status: Status
  /** 0..1 through the chapter. */
  progress: number
  /** Index of the verse being read, or -1. */
  index: number
  /** Seconds, known for narration only. */
  elapsed?: number
  duration?: number
}

export interface EngineCallbacks {
  onUpdate(patch: Partial<PlaybackState>): void
  onEnded(): void
}

export interface Engine {
  play(fromIndex?: number): void
  pause(): void
  seek(fraction: number): void
  setRate(rate: number): void
  destroy(): void
}

/** Index of the verse playing at time t, given each verse's start time. */
export function verseAt(starts: number[], t: number): number {
  let lo = 0
  let hi = starts.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (starts[mid] <= t) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

export class NarrationEngine implements Engine {
  private audio: HTMLAudioElement
  private starts: number[] = []
  private pendingIndex: number | undefined
  private readonly cb: EngineCallbacks
  private readonly off: () => void

  constructor(url: string, timingsPath: string, rate: number, cb: EngineCallbacks) {
    this.cb = cb
    const audio = (this.audio = new Audio(url))
    audio.preload = 'auto'
    audio.playbackRate = rate

    fetchAudioTimings(timingsPath)
      .then((t) => {
        this.starts = t.verses
        if (this.pendingIndex !== undefined) this.jumpTo(this.pendingIndex)
        this.pendingIndex = undefined
      })
      .catch(() => {
        // Playback still works without timings; only verse sync is lost.
      })

    const update = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : undefined
      cb.onUpdate({
        elapsed: audio.currentTime,
        duration,
        progress: duration ? audio.currentTime / duration : 0,
        index: verseAt(this.starts, audio.currentTime + 0.05),
      })
    }
    const handlers: [string, () => void][] = [
      ['timeupdate', update],
      ['loadedmetadata', update],
      ['seeked', update],
      ['playing', () => cb.onUpdate({ status: 'playing' })],
      ['waiting', () => cb.onUpdate({ status: 'loading' })],
      ['pause', () => !audio.ended && cb.onUpdate({ status: 'paused' })],
      ['ended', () => {
        cb.onUpdate({ status: 'idle', progress: 1 })
        cb.onEnded()
      }],
      ['error', () => cb.onUpdate({ status: 'idle' })],
    ]
    for (const [e, h] of handlers) audio.addEventListener(e, h)
    this.off = () => handlers.forEach(([e, h]) => audio.removeEventListener(e, h))
  }

  private jumpTo(index: number) {
    if (this.starts.length) this.audio.currentTime = this.starts[Math.min(index, this.starts.length - 1)]
    else this.pendingIndex = index
  }

  play(fromIndex?: number) {
    if (fromIndex !== undefined) this.jumpTo(fromIndex)
    this.cb.onUpdate({ status: 'loading' })
    this.audio.play().catch(() => this.cb.onUpdate({ status: 'paused' }))
  }

  pause() {
    this.audio.pause()
  }

  seek(fraction: number) {
    if (Number.isFinite(this.audio.duration)) this.audio.currentTime = fraction * this.audio.duration
  }

  setRate(rate: number) {
    this.audio.playbackRate = rate
  }

  destroy() {
    this.off()
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
  }
}

interface Segment {
  verseIndex: number
  text: string
  /** Offset of this segment in the chapter's total text length. */
  start: number
}

const MAX_SEGMENT = 180

/**
 * Splits text into chunks of at most `max` characters, preferring sentence
 * then clause boundaries. Short utterances also sidestep Chrome's habit of
 * silently stopping long ones.
 */
export function splitText(text: string, max = MAX_SEGMENT): string[] {
  if (text.length <= max) return text ? [text] : []
  const out: string[] = []
  for (const sep of [/(?<=[.!?;:])\s+/, /(?<=[,])\s+/, /\s+/]) {
    const pieces = text.split(sep)
    if (pieces.length < 2) continue
    let cur = ''
    for (const p of pieces) {
      if (cur && cur.length + 1 + p.length > max) {
        out.push(...splitText(cur, max))
        cur = p
      } else {
        cur = cur ? `${cur} ${p}` : p
      }
    }
    if (cur) out.push(...splitText(cur, max))
    return out
  }
  // A single huge word: give up and speak it whole.
  return [text]
}

export function buildSegments(verses: string[]): { segments: Segment[]; total: number } {
  const segments: Segment[] = []
  let total = 0
  verses.forEach((v, verseIndex) => {
    for (const text of splitText(v)) {
      segments.push({ verseIndex, text, start: total })
      total += text.length + 1
    }
  })
  return { segments, total: Math.max(total, 1) }
}

export class SpeechEngine implements Engine {
  private readonly segments: Segment[]
  private readonly total: number
  private seg = 0
  private generation = 0
  private playing = false
  private rate: number
  private readonly lang: string
  private readonly voice: SpeechSynthesisVoice | null
  private readonly cb: EngineCallbacks

  constructor(
    verses: string[],
    lang: string,
    voice: SpeechSynthesisVoice | null,
    rate: number,
    cb: EngineCallbacks,
  ) {
    ;({ segments: this.segments, total: this.total } = buildSegments(verses))
    this.lang = lang
    this.voice = voice
    this.rate = rate
    this.cb = cb
  }

  private report() {
    const s = this.segments[this.seg]
    if (s) this.cb.onUpdate({ index: s.verseIndex, progress: s.start / this.total })
  }

  private speak() {
    const synth = window.speechSynthesis
    const gen = ++this.generation
    synth.cancel()
    const s = this.segments[this.seg]
    if (!s) return

    const u = new SpeechSynthesisUtterance(s.text)
    u.lang = this.voice?.lang ?? this.lang
    if (this.voice) u.voice = this.voice
    u.rate = this.rate
    u.onstart = () => gen === this.generation && this.cb.onUpdate({ status: 'playing' })
    u.onboundary = (e) => {
      if (gen === this.generation) this.cb.onUpdate({ progress: (s.start + e.charIndex) / this.total })
    }
    u.onend = () => {
      if (gen !== this.generation) return
      this.seg++
      if (this.seg >= this.segments.length) {
        this.playing = false
        this.seg = 0
        this.cb.onUpdate({ status: 'idle', progress: 1 })
        this.cb.onEnded()
      } else {
        this.report()
        this.speak()
      }
    }
    u.onerror = (e) => {
      if (gen !== this.generation || e.error === 'interrupted' || e.error === 'canceled') return
      this.playing = false
      this.cb.onUpdate({ status: 'paused' })
    }
    this.report()
    synth.speak(u)
  }

  private firstSegmentOf(verseIndex: number) {
    const i = this.segments.findIndex((s) => s.verseIndex >= verseIndex)
    return i === -1 ? 0 : i
  }

  play(fromIndex?: number) {
    if (fromIndex !== undefined) this.seg = this.firstSegmentOf(fromIndex)
    this.playing = true
    this.cb.onUpdate({ status: 'loading' })
    this.speak()
  }

  pause() {
    this.playing = false
    this.generation++
    window.speechSynthesis.cancel()
    this.cb.onUpdate({ status: 'paused' })
  }

  seek(fraction: number) {
    const target = fraction * this.total
    let i = 0
    while (i + 1 < this.segments.length && this.segments[i + 1].start <= target) i++
    this.seg = i
    if (this.playing) this.speak()
    else this.report()
  }

  setRate(rate: number) {
    this.rate = rate
    if (this.playing) this.speak()
  }

  destroy() {
    this.playing = false
    this.generation++
    window.speechSynthesis.cancel()
  }
}
