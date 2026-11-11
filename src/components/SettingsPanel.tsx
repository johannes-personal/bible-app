import { useEffect } from 'react'
import { FONTS, loadFont, type Settings, type Theme, type UpdateSettings } from '../settings'
import { Icon } from './Icon'
import { OfflineSettings } from './Offline'
import { Sheet } from './Sheet'

interface Props {
  settings: Settings
  update: UpdateSettings
  onClose: () => void
  /** The second translation shown beside the first, or null. */
  parallelName: string | null
  onChooseParallel: () => void
}

const THEMES: { id: Theme; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'dark', label: 'Dark' },
]

export function SettingsPanel({ settings, update, onClose, parallelName, onChooseParallel }: Props) {
  // Each font option is shown in its own face.
  useEffect(() => {
    FONTS.forEach(loadFont)
  }, [])
  return (
    <Sheet title="Reading settings" onClose={onClose} size="narrow">
      <div className="settings">
        <fieldset>
          <legend>Theme</legend>
          <div className="segmented">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`theme-swatch theme-${t.id}${settings.theme === t.id ? ' selected' : ''}`}
                onClick={() => update({ theme: t.id })}
                aria-pressed={settings.theme === t.id}
              >
                {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Font</legend>
          <div className="font-options">
            {FONTS.map((f) => (
              <button
                key={f.id}
                className={`font-option${settings.font === f.id ? ' selected' : ''}`}
                onClick={() => update({ font: f.id })}
                aria-pressed={settings.font === f.id}
                style={{ fontFamily: f.family, fontSize: `${13 * f.scale}px` }}
              >
                <span className="font-sample" aria-hidden="true">Aa</span>
                {f.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Text size</legend>
          <div className="size-row">
            <button
              className="size-button small"
              onClick={() => update({ fontSize: Math.max(14, settings.fontSize - 1) })}
              aria-label="Smaller text"
            >
              A
            </button>
            <input
              type="range"
              min={14}
              max={30}
              value={settings.fontSize}
              onChange={(e) => update({ fontSize: Number(e.target.value) })}
              aria-label="Text size"
            />
            <button
              className="size-button large"
              onClick={() => update({ fontSize: Math.min(30, settings.fontSize + 1) })}
              aria-label="Larger text"
            >
              A
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>Side by side</legend>
          <div className="parallel-setting">
            <button className="button secondary" onClick={onChooseParallel}>
              {parallelName ? (
                <>
                  {parallelName} <Icon name="chevronDown" />
                </>
              ) : (
                'Add a second translation'
              )}
            </button>
            {parallelName && (
              <button className="link" onClick={() => update({ parallel: null })}>
                Turn off
              </button>
            )}
          </div>
          <p className="muted setting-note">Shows another translation verse by verse, scrolling together.</p>
        </fieldset>

        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showVerseNumbers}
            onChange={(e) => update({ showVerseNumbers: e.target.checked })}
          />
          Verse numbers
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.redLetters}
            onChange={(e) => update({ redLetters: e.target.checked })}
          />
          <span>
            Words of Jesus in red <span className="muted">(where the translation marks them)</span>
          </span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.relatedVerses}
            onChange={(e) => update({ relatedVerses: e.target.checked })}
          />
          <span>
            Related-verse markers <span className="muted">(verses that are quoted or closely echoed elsewhere)</span>
          </span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.longPressWords}
            onChange={(e) => update({ longPressWords: e.target.checked })}
          />
          <span>
            Press and hold a verse for its Hebrew or Greek words{' '}
            <span className="muted">(tapping the verse number always shows them; with this off, pressing and holding selects text as usual)</span>
          </span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.swipeChapters}
            onChange={(e) => update({ swipeChapters: e.target.checked })}
          />
          <span>
            Swipe to turn the chapter <span className="muted">(on touch screens)</span>
          </span>
        </label>

        <OfflineSettings />
      </div>
    </Sheet>
  )
}
