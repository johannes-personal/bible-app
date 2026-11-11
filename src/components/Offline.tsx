import type { ReactNode } from 'react'
import type { Translation } from '../api'
import { isIOS, isTouchScreen } from '../device'
import { useAsync } from '../hooks'
import { isInstalled, useInstallPrompt } from '../offline/install'
import {
  cancelSaving,
  offlineSupported,
  removeTranslation,
  removeWordStudy,
  saveTranslation,
  saveWordStudy,
  useOffline,
  WORD_STUDY,
  wordStudyFiles,
  type Job,
} from '../offline/store'
import { Icon } from './Icon'

// The controls for reading without a connection: saving a translation (in the translation
// list), saving the word study data (on its start page), and what's saved plus how to put the
// app on the home screen (in the reading settings).

/** The Free Use Bible API id a translation can be saved under, if it has an open source there. */
const freeIdOf = (t: Translation) => t.freeId ?? (t.source ? undefined : t.id)

/** While saving: what's happening, how far along, and a way to stop. After a failure: why, and retry. */
function Saving({ job, label, onCancel, onRetry }: { job: Job; label: string; onCancel: () => void; onRetry: () => void }) {
  if (job.error) {
    return (
      <>
        <span className="offline-text">
          Couldn't save {label}. <span className="muted">{job.error}</span>
        </span>
        <button className="link" onClick={onRetry}>Try again</button>
        <button className="link" onClick={onCancel}>Dismiss</button>
      </>
    )
  }
  const percent = job.progress == null ? null : Math.round(job.progress * 100)
  return (
    <>
      <span className="offline-text" role="status">
        Saving {label}… <span className="muted">{percent == null ? job.detail : `${percent}%`}</span>
        <progress className="offline-progress" max={1} value={job.progress ?? undefined} aria-label={`Saving ${label}`} />
      </span>
      <button className="link" onClick={onCancel}>Cancel</button>
    </>
  )
}

/** In the translation list: save the translation being read for offline reading, or remove it. */
export function SaveTranslation({ translation }: { translation: Translation | null | undefined }) {
  const { saved, jobs } = useOffline()
  if (!offlineSupported || !translation) return null
  const name = translation.shortName || translation.name
  const freeId = freeIdOf(translation)

  let content: ReactNode
  if (!freeId) {
    content = (
      <span className="offline-text muted">
        {name} can only be read with a connection. Free translations, such as the BSB, can be saved for reading offline.
      </span>
    )
  } else if (jobs[freeId]) {
    content = (
      <Saving job={jobs[freeId]} label={name} onCancel={() => cancelSaving(freeId)} onRetry={() => void saveTranslation(freeId, name)} />
    )
  } else if (saved.translations[freeId]) {
    content = (
      <>
        <Icon name="check" />
        <span className="offline-text">
          <strong>{name}</strong> is saved for reading offline
        </span>
        <button className="link" onClick={() => void removeTranslation(freeId)}>Remove</button>
      </>
    )
  } else {
    return (
      <div className="offline-row plain">
        <button className="button secondary" onClick={() => void saveTranslation(freeId, name)}>
          <Icon name="download" /> Save {name} for reading offline
        </button>
      </div>
    )
  }
  return <div className="offline-row">{content}</div>
}

/** On word study's start page: save its data for studying without a connection. */
export function SaveWordStudy() {
  const { saved, jobs } = useOffline()
  const { data: list } = useAsync(offlineSupported && !saved.wordStudy ? 'word-study-files' : null, () => wordStudyFiles())
  if (!offlineSupported) return null
  const job = jobs[WORD_STUDY]
  // With the BSB, whose text the verses are shown in (about 8 MB), unless it's saved already.
  const megabytes = list ? Math.round((list.bytes + (saved.translations.BSB ? 0 : 8.3e6)) / 1e6) : null

  if (job) {
    return (
      <div className="offline-row">
        <Saving job={job} label="word study" onCancel={() => cancelSaving(WORD_STUDY)} onRetry={() => void saveWordStudy()} />
      </div>
    )
  }
  if (saved.wordStudy) {
    return (
      <div className="offline-row">
        <Icon name="check" />
        <span className="offline-text">
          Word study is saved for use offline.{' '}
          <span className="muted">A verse's Hebrew or Greek words still need a connection the first time.</span>
        </span>
        <button className="link" onClick={() => void removeWordStudy()}>Remove</button>
      </div>
    )
  }
  return (
    <div className="offline-row plain">
      <button className="button secondary" onClick={() => void saveWordStudy()}>
        <Icon name="download" /> Save word study for use offline{megabytes ? ` (about ${megabytes} MB)` : ''}
      </button>
    </div>
  )
}

/** In the reading settings: what's saved on the device, and how to add the app to the home screen. */
export function OfflineSettings() {
  const { saved } = useOffline()
  const install = useInstallPrompt()
  if (!offlineSupported) return null
  const translations = Object.entries(saved.translations)
  const installed = isInstalled()

  return (
    <fieldset>
      <legend>Offline</legend>
      {translations.length === 0 && !saved.wordStudy ? (
        <p className="muted setting-note">
          To read without a connection, save a translation: open the translation list and choose “Save … for reading
          offline”.
        </p>
      ) : (
        <ul className="offline-saved">
          {translations.map(([freeId, t]) => (
            <li key={freeId}>
              <Icon name="check" />
              <span>{t.name}</span>
              <button className="link" onClick={() => void removeTranslation(freeId)}>Remove</button>
            </li>
          ))}
          {saved.wordStudy && (
            <li>
              <Icon name="check" />
              <span>Word study</span>
              <button className="link" onClick={() => void removeWordStudy()}>Remove</button>
            </li>
          )}
        </ul>
      )}
      {!installed &&
        (install ? (
          <button className="button secondary offline-install" onClick={install}>
            <Icon name="download" /> Install as an app
          </button>
        ) : isIOS() ? (
          <p className="muted setting-note">
            To use it like an app: tap Share, then “Add to Home Screen”. The home screen app keeps its own saved
            translations, so save them from there.
          </p>
        ) : isTouchScreen() ? (
          <p className="muted setting-note">To use it like an app, choose “Install” or “Add to Home screen” in your browser’s menu.</p>
        ) : null)}
    </fieldset>
  )
}
