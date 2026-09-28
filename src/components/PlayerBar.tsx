import { useCallback, useState, type CSSProperties } from 'react'
import type { Player } from '../audio/usePlayer'
import type { Settings, UpdateSettings } from '../settings'
import { Icon } from './Icon'

interface Props {
  player: Player
  settings: Settings
  update: UpdateSettings
  verseCount: number
  languageName: string
  loading: boolean
  onPrevious?: () => void
  onNext?: () => void
}

const RATES = [0.75, 1, 1.25, 1.5, 1.75, 2]

/**
 * Publishes the bar's height as --player-h so the page leaves room for it at the bottom.
 * The bar grows when the audio options are open, and would otherwise cover the chapter's
 * previous/next buttons.
 */
function useHeightVariable() {
  return useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const root = document.documentElement
    const observer = new ResizeObserver(() => root.style.setProperty('--player-h', `${el.offsetHeight}px`))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
}

function formatTime(s: number | undefined) {
  if (s === undefined || !Number.isFinite(s)) return '–:––'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export function PlayerBar({ player, settings, update, verseCount, languageName, loading, onPrevious, onNext }: Props) {
  const { state, sources, sourceId, voices, voice, lang } = player
  const [open, setOpen] = useState(false)
  const heightRef = useHeightVariable()
  // Value while the user drags the progress bar; committed on release.
  const [dragging, setDragging] = useState<number | null>(null)

  const active = state.status !== 'idle'
  const busy = state.status === 'playing' || state.status === 'loading'
  const progress = dragging ?? (active || state.progress === 1 ? state.progress : 0)
  const narrated = sourceId !== null && sourceId !== 'tts'

  const commit = () => {
    if (dragging !== null) player.seek(dragging)
    setDragging(null)
  }

  if (!sources.length) {
    return (
      <div ref={heightRef} className="player player-empty">
        <span className="muted">
          {loading ? 'Loading…' : `Audio isn't available for ${languageName} on this device.`}
        </span>
      </div>
    )
  }

  let label: string
  if (narrated) {
    const elapsed = dragging !== null && state.duration ? dragging * state.duration : state.elapsed
    label = `${formatTime(elapsed)} / ${formatTime(state.duration)}`
  } else {
    label = active && state.index >= 0 ? `Verse ${state.index + 1} of ${verseCount}` : `${verseCount} verses`
  }

  return (
    <div ref={heightRef} className="player">
      {open && (
        <div className="player-options">
          <label>
            <span>Voice</span>
            <select value={sourceId ?? ''} onChange={(e) => update({ audioSource: e.target.value })}>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          {sourceId === 'tts' && voices.length > 1 && lang && (
            <label>
              <span>Device voice</span>
              <select
                value={voice?.voiceURI ?? ''}
                onChange={(e) => update({ ttsVoiceURI: { ...settings.ttsVoiceURI, [lang]: e.target.value } })}
              >
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span>Speed</span>
            <select value={settings.rate} onChange={(e) => update({ rate: Number(e.target.value) })}>
              {RATES.map((r) => (
                <option key={r} value={r}>
                  {r}×
                </option>
              ))}
            </select>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.autoscroll}
              onChange={(e) => update({ autoscroll: e.target.checked })}
            />
            Auto-scroll
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.continueToNext}
              onChange={(e) => update({ continueToNext: e.target.checked })}
            />
            Continue to next chapter
          </label>
        </div>
      )}

      <div className="player-main">
        <div className="player-buttons">
          <button className="icon-button" onClick={onPrevious} disabled={!onPrevious} aria-label="Previous chapter">
            <Icon name="skipBack" />
          </button>
          <button
            className={`play-button${state.status === 'loading' ? ' loading' : ''}`}
            onClick={player.toggle}
            aria-label={busy ? 'Pause' : 'Play'}
          >
            <Icon name={busy ? 'pause' : 'play'} />
          </button>
          <button className="icon-button" onClick={onNext} disabled={!onNext} aria-label="Next chapter">
            <Icon name="skipForward" />
          </button>
        </div>

        <div className="player-progress">
          <input
            type="range"
            className="progress"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            style={{ '--value': `${progress * 100}%` } as CSSProperties}
            onChange={(e) => setDragging(Number(e.target.value))}
            onPointerUp={commit}
            onKeyUp={commit}
            onBlur={commit}
            aria-label="Chapter progress"
            aria-valuetext={label}
          />
          <div className="player-meta">
            <span>{label}</span>
            <span className="player-source">
              {sources.find((s) => s.id === sourceId)?.label}
              {settings.rate !== 1 && ` · ${settings.rate}×`}
            </span>
          </div>
        </div>

        <button
          className={`icon-button${open ? ' selected' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-label="Audio options"
          aria-expanded={open}
        >
          <Icon name="settings" />
        </button>
      </div>
    </div>
  )
}
