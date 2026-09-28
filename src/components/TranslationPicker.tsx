import { useMemo, useState } from 'react'
import { fetchTranslations, type Translation } from '../api'
import { useAsync } from '../hooks'
import { languageKey, preferredLanguages } from '../lang'
import { groupTranslations, partitionLanguages, recentTranslationIds, type LanguageGroup } from '../translations'
import { Icon } from './Icon'
import { Sheet } from './Sheet'

interface Props {
  currentId: string
  onSelect: (t: Translation) => void
  onClose: () => void
}

export function TranslationPicker({ currentId, onSelect, onClose }: Props) {
  const { data, error, loading, retry } = useAsync('translations', fetchTranslations)
  const [query, setQuery] = useState('')
  // undefined: not chosen yet, so open on the current translation's language. null: all languages.
  const [chosenLanguage, setChosenLanguage] = useState<string | null | undefined>(undefined)

  const preferred = useMemo(() => preferredLanguages(), [])
  const current = data?.find((t) => t.id === currentId)
  const currentLanguage = current && languageKey(current.language)
  const language = chosenLanguage === undefined ? currentLanguage : chosenLanguage

  const allGroups = useMemo(() => (data ? groupTranslations(data, preferred) : []), [data, preferred])
  const searchGroups = useMemo(
    () => (data && query.trim() ? groupTranslations(data, preferred, query) : []),
    [data, preferred, query],
  )
  const { suggested, others } = useMemo(
    () => partitionLanguages(allGroups, preferred, currentLanguage),
    [allGroups, preferred, currentLanguage],
  )
  const recent = useMemo(() => {
    if (!data) return []
    return recentTranslationIds().map((id) => data.find((t) => t.id === id)).filter((t): t is Translation => !!t)
  }, [data])

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

  const status = (
    <>
      {loading && !data && <p className="muted center">Loading translations…</p>}
      {error && (
        <p className="muted center">
          Couldn't load translations. <button className="link" onClick={retry}>Try again</button>
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
          <button className="link back" onClick={() => setChosenLanguage(null)}>
            <Icon name="back" /> All languages
          </button>
        }
      >
        <ul className="list list-top">{group.translations.map(row)}</ul>
      </Sheet>
    )
  }

  // First level: languages, or translations matching a search across all languages.
  return (
    <Sheet
      title="Translation"
      onClose={onClose}
      toolbar={
        <input
          className="search"
          type="search"
          placeholder="Search translations or languages"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
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
            <p className="muted center">No translations match “{query}”.</p>
          )}
        </>
      ) : (
        <>
          {recent.length > 0 && (
            <section>
              <h3 className="group-label">Recent</h3>
              <ul className="list">{recent.map(row)}</ul>
            </section>
          )}
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
