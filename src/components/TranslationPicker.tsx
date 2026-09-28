import { useMemo, useState } from 'react'
import { fetchTranslations, type Translation } from '../api'
import { useAsync } from '../hooks'
import { preferredLanguages } from '../lang'
import { groupTranslations, recentTranslationIds } from '../translations'
import { Sheet } from './Sheet'

interface Props {
  currentId: string
  onSelect: (t: Translation) => void
  onClose: () => void
}

export function TranslationPicker({ currentId, onSelect, onClose }: Props) {
  const { data, error, loading, retry } = useAsync('translations', fetchTranslations)
  const [query, setQuery] = useState('')

  const groups = useMemo(
    () => (data ? groupTranslations(data, preferredLanguages(), query) : []),
    [data, query],
  )
  const recent = useMemo(() => {
    if (!data || query) return []
    return recentTranslationIds().map((id) => data.find((t) => t.id === id)).filter((t): t is Translation => !!t)
  }, [data, query])

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

  return (
    <Sheet
      title="Translation"
      onClose={onClose}
      toolbar={
        <input
          className="search"
          type="search"
          placeholder={data ? `Search ${data.length.toLocaleString()} translations or languages` : 'Search'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      }
    >
      {loading && !data && <p className="muted center">Loading translations…</p>}
      {error && (
        <p className="muted center">
          Couldn't load translations. <button className="link" onClick={retry}>Try again</button>
        </p>
      )}
      {recent.length > 0 && (
        <section>
          <h3 className="group-label">Recent</h3>
          <ul className="list">{recent.map(row)}</ul>
        </section>
      )}
      {groups.map((g) => (
        <section key={g.language}>
          <h3 className="group-label">
            {g.label} <span className="count">{g.translations.length}</span>
          </h3>
          <ul className="list">{g.translations.map(row)}</ul>
        </section>
      ))}
      {data && groups.length === 0 && <p className="muted center">No translations match “{query}”.</p>}
    </Sheet>
  )
}
