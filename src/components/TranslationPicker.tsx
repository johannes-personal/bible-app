import { useMemo, useState, type ReactNode } from 'react'
import { fetchTranslations, findTranslation, youVersionUnavailable, type Translation } from '../api'
import { useAsync, useOnline } from '../hooks'
import { useOffline } from '../offline/store'
import { languageKey, preferredLanguages } from '../lang'
import { load, save } from '../storage'
import { groupTranslations, hasNarration, partitionLanguages, recentTranslationIds, type LanguageGroup } from '../translations'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

interface Props {
  currentId: string
  onSelect: (t: Translation) => void
  onClose: () => void
  /** Defaults to "Translation". */
  title?: string
  /** Shown above the list on every level (e.g. the side-by-side options). */
  extra?: ReactNode
}

const AUDIO_ONLY_KEY = 'bible:audio-only'

export function TranslationPicker({ currentId, onSelect, onClose, title = 'Translation', extra }: Props) {
  const { data, error, loading, retry } = useAsync('translations', fetchTranslations)
  const [query, setQuery] = useState('')
  // undefined: not chosen yet, so open on the current translation's language. null: all languages.
  const [chosenLanguage, setChosenLanguage] = useState<string | null | undefined>(undefined)

  // Only translations with a recorded audio Bible; remembered for next time.
  const [audioOnly, setAudioOnly] = useState(() => load<boolean>(AUDIO_ONLY_KEY, false))
  const toggleAudioOnly = () => {
    save(AUDIO_ONLY_KEY, !audioOnly)
    setAudioOnly(!audioOnly)
  }
  const audioFilter = (
    <button
      className={`chip-toggle${audioOnly ? ' on' : ''}`}
      aria-pressed={audioOnly}
      onClick={toggleAudioOnly}
      title="Show only translations with a recorded audio Bible"
    >
      <Icon name="headphones" /> With audio
    </button>
  )

  // Translations saved on the device for reading offline (by their Free Use Bible API id).
  const { saved } = useOffline()
  const isSaved = (t: Translation) => !!saved.translations[t.freeId ?? t.id]
  const online = useOnline()

  const preferred = useMemo(() => preferredLanguages(), [])
  const current = findTranslation(data, currentId)
  const currentLanguage = current && languageKey(current.language)
  // Offline it opens on the overview, which lists what's saved on the device first.
  const language = chosenLanguage === undefined ? (online ? currentLanguage : null) : chosenLanguage

  const allGroups = useMemo(() => (data ? groupTranslations(data, preferred, '', audioOnly) : []), [data, preferred, audioOnly])
  const searchGroups = useMemo(
    () => (data && query.trim() ? groupTranslations(data, preferred, query, audioOnly) : []),
    [data, preferred, query, audioOnly],
  )
  const { suggested, others } = useMemo(
    () => partitionLanguages(allGroups, preferred, currentLanguage),
    [allGroups, preferred, currentLanguage],
  )
  const recent = useMemo(() => {
    if (!data) return []
    const recent = recentTranslationIds().map((id) => findTranslation(data, id))
    return [...new Set(recent)].filter((t): t is Translation => !!t && (!audioOnly || hasNarration(t)))
  }, [data, audioOnly])

  const savedList = useMemo(
    () =>
      (data ?? [])
        .filter((t) => !!saved.translations[t.freeId ?? t.id] && (!audioOnly || hasNarration(t)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data, saved, audioOnly],
  )

  const row = (t: Translation) => (
    <li key={t.id}>
      <button
        className={`list-row${t.id === currentId ? ' selected' : ''}`}
        onClick={() => onSelect(t)}
        aria-current={t.id === currentId}
      >
        <span className="list-row-main">
          <span className="list-row-title">{t.name}</span>
          {t.englishName && t.englishName !== t.name && (
            <span className="list-row-sub">{t.englishName}</span>
          )}
        </span>
        {hasNarration(t) && (
          <span className="narrated" title="Recorded audio Bible" aria-label="Recorded audio Bible" role="img">
            <Icon name="headphones" />
          </span>
        )}
        {isSaved(t) && (
          <span className="narrated saved-offline" title="Saved for reading offline" aria-label="Saved for reading offline" role="img">
            <Icon name="download" />
          </span>
        )}
        <span className="badge">{t.shortName || t.id}</span>
      </button>
    </li>
  )

  const languageCells = (groups: LanguageGroup[]) => (
    <div className="book-grid">
      {groups.map((g) => (
        <button
          key={g.language}
          className={`book-cell language-cell${g.language === currentLanguage ? ' selected' : ''}`}
          onClick={() => setChosenLanguage(g.language)}
        >
          <span>{g.label}</span>
          <span className="count">{g.translations.length}</span>
        </button>
      ))}
    </div>
  )

  const savedSection = savedList.length > 0 && (
    <section>
      <h3 className="group-label">Saved for reading offline</h3>
      <ul className="list">{savedList.map(row)}</ul>
    </section>
  )

  const status = (
    <>
      {extra}
      {loading && !data && <p className="muted center">Loading translations…</p>}
      {error && (
        <p className="muted center">
          Couldn't load translations. <button className="link" onClick={retry}>Try again</button>
        </p>
      )}
      {data && audioOnly && (
        <p className="muted audio-note">
          Showing only translations with a recorded audio Bible. Others can still be read aloud with your device's voice.
        </p>
      )}
      {data && !loading && !online && (
        <p className="notice">
          You're offline. Translations saved on this device <Icon name="download" /> can be read, as can chapters of other free
          translations you've opened before.
        </p>
      )}
      {data && !loading && online && youVersionUnavailable() && (
        <p className="notice">
          YouVersion translations (such as NIV) couldn't be loaded.{' '}
          <button className="link" onClick={retry}>Try again</button>
        </p>
      )}
    </>
  )

  // Second level: the translations in one language.
  const group = !query.trim() && language ? allGroups.find((g) => g.language === language) : undefined
  if (group) {
    return (
      <Sheet
        title={group.label}
        onClose={onClose}
        toolbar={
          <div className="picker-toolbar">
            <button className="link back" onClick={() => setChosenLanguage(null)}>
              <Icon name="back" /> All languages
            </button>
            {audioFilter}
          </div>
        }
      >
        {status}
        <ul className="list list-top">{group.translations.map(row)}</ul>
        {group.translations.length === 0 && <p className="muted center">No translations with recorded audio in {group.label}.</p>}
      </Sheet>
    )
  }

  // First level: languages, or translations matching a search across all languages.
  return (
    <Sheet
      title={title}
      onClose={onClose}
      toolbar={
        <div className="picker-toolbar">
          <input
            className="search"
            type="search"
            placeholder="Search translations or languages"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {audioFilter}
        </div>
      }
    >
      {status}
      {query.trim() ? (
        <>
          {searchGroups.map((g) => (
            <section key={g.language}>
              <h3 className="group-label">
                {g.label} <span className="count">{g.translations.length}</span>
              </h3>
              <ul className="list">{g.translations.map(row)}</ul>
            </section>
          ))}
          {data && searchGroups.length === 0 && (
            <p className="muted center">
              No translations {audioOnly ? 'with recorded audio ' : ''}match “{query}”.
            </p>
          )}
        </>
      ) : (
        <>
          {!online && savedSection}
          {recent.length > 0 && (
            <section>
              <h3 className="group-label">Recent</h3>
              <ul className="list">{recent.map(row)}</ul>
            </section>
          )}
          {online && savedSection}
          {suggested.length > 0 && (
            <section>
              <h3 className="group-label">Suggested languages</h3>
              {languageCells(suggested)}
            </section>
          )}
          {others.length > 0 && (
            <section>
              <h3 className="group-label">
                All languages <span className="count">{others.length}</span>
              </h3>
              {languageCells(others)}
            </section>
          )}
        </>
      )}
    </Sheet>
  )
}
