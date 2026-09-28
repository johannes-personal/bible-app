import type { Settings, Theme, UpdateSettings } from '../settings'
import { Sheet } from './Sheet'

interface Props {
  settings: Settings
  update: UpdateSettings
  onClose: () => void
}

const THEMES: { id: Theme; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'dark', label: 'Dark' },
]

export function SettingsPanel({ settings, update, onClose }: Props) {
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
          Words of Jesus in red <span className="muted">(where the translation marks them)</span>
        </label>
      </div>
    </Sheet>
  )
}
