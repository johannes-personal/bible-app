import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSegments, estimateStarts, SpeechEngine, splitText, verseAt } from '../audio/engines'

describe('verseAt', () => {
  const starts = [4, 9.7, 22.8, 31.6]
  it('finds the verse playing at a time', () => {
    expect(verseAt(starts, 0)).toBe(-1)
    expect(verseAt(starts, 4)).toBe(0)
    expect(verseAt(starts, 22)).toBe(1)
    expect(verseAt(starts, 500)).toBe(3)
  })
  it('handles missing timings', () => {
    expect(verseAt([], 10)).toBe(-1)
  })
})

describe('estimateStarts', () => {
  it('spreads verses over a recording by length, after the chapter is announced', () => {
    const starts = estimateStarts(['The LORD is my shepherd; I shall not want.', 'He makes me lie down in green pastures.', 'Short.'], 60)
    expect(starts).toHaveLength(3)
    expect(starts[0]).toBe(3)
    expect(starts[1]).toBeGreaterThan(starts[0])
    expect(starts[2] - starts[1]).toBeLessThan(starts[1] - starts[0])
    expect(starts[2]).toBeLessThan(60)
  })
  it('gives nothing without verses or a length', () => {
    expect(estimateStarts([], 60)).toEqual([])
    expect(estimateStarts(['A verse.'], NaN)).toEqual([])
  })
})

describe('splitText', () => {
  it('leaves short text alone', () => {
    expect(splitText('In the beginning.')).toEqual(['In the beginning.'])
    expect(splitText('')).toEqual([])
  })

  it('splits long text at sentence boundaries within the limit', () => {
    const text = 'First sentence here. Second one follows! Third is a question? Fourth ends it.'
    const parts = splitText(text, 45)
    expect(parts.every((p) => p.length <= 45)).toBe(true)
    expect(parts.join(' ')).toBe(text)
  })

  it('falls back to commas and spaces', () => {
    const text = 'word '.repeat(60).trim()
    const parts = splitText(text, 50)
    expect(parts.every((p) => p.length <= 50)).toBe(true)
    expect(parts.join(' ')).toBe(text)
  })
})

describe('buildSegments', () => {
  it('tracks verse index and running offsets', () => {
    const { segments, total } = buildSegments(['abc', 'de'])
    expect(segments).toEqual([
      { verseIndex: 0, text: 'abc', start: 0 },
      { verseIndex: 1, text: 'de', start: 4 },
    ])
    expect(total).toBe(7)
  })
})

describe('SpeechEngine', () => {
  /** A stand-in for the browser's speech synthesis that speaks nothing until told to. */
  function fakeSynth() {
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      spoken: [] as { text: string; onstart?: () => void; onend?: () => void }[],
      getVoices: () => [],
      speak: vi.fn((u: { text: string }) => synth.spoken.push(u)),
      cancel: vi.fn(() => {
        synth.speaking = false
      }),
      resume: vi.fn(() => {
        synth.paused = false
      }),
    }
    class Utterance {
      text: string
      constructor(text: string) {
        this.text = text
      }
    }
    vi.stubGlobal('window', { speechSynthesis: synth })
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance)
    return synth
  }
  const callbacks = () => ({ onUpdate: vi.fn(), onEnded: vi.fn() })

  // A later clock for each test, so no test starts just after another one's cancel.
  let clock = Date.UTC(2030, 0, 1)
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime((clock += 60_000))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('speaks at once when nothing was cancelled, keeping the tap iOS needs', async () => {
    const synth = fakeSynth()
    new SpeechEngine(['O LORD, our Lord.'], 'en', null, 1, callbacks()).play()
    expect(synth.speak).toHaveBeenCalledTimes(1)
  })

  it('waits a moment after a cancel before speaking again', async () => {
    const synth = fakeSynth()
    const first = new SpeechEngine(['Psalm seven.'], 'en', null, 1, callbacks())
    first.play()
    synth.speaking = true
    first.destroy() // moving on to the next chapter
    new SpeechEngine(['Psalm eight.'], 'en', null, 1, callbacks()).play()
    expect(synth.speak).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(300)
    expect(synth.spoken.map((u) => u.text)).toEqual(['Psalm seven.', 'Psalm eight.'])
  })

  it('tries again when nothing starts, then gives up as paused', async () => {
    const synth = fakeSynth()
    const cb = callbacks()
    new SpeechEngine(['O LORD, our Lord.'], 'en', null, 1, cb).play()
    await vi.advanceTimersByTimeAsync(2600)
    expect(synth.speak).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(3000)
    expect(synth.speak).toHaveBeenCalledTimes(2)
    expect(cb.onUpdate).toHaveBeenLastCalledWith({ status: 'paused' })
  })

  it('carries on through the segments once speech starts, and resumes a paused synthesizer', async () => {
    const synth = fakeSynth()
    synth.paused = true
    const cb = callbacks()
    new SpeechEngine(['One.', 'Two.'], 'en', null, 1, cb).play()
    expect(synth.resume).toHaveBeenCalled()
    synth.spoken[0].onstart?.()
    synth.spoken[0].onend?.()
    synth.spoken[1].onstart?.()
    await vi.advanceTimersByTimeAsync(3000)
    expect(synth.speak).toHaveBeenCalledTimes(2)
    synth.spoken[1].onend?.()
    expect(cb.onEnded).toHaveBeenCalled()
  })
})
