import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchBooks, fetchChapter, type ChapterRef, type Translation } from './api'
import { useAutoscroll } from './audio/useAutoscroll'
import { usePlayer } from './audio/usePlayer'
import { Icon } from './components/Icon'
import { PassagePicker } from './components/PassagePicker'
import { PlayerBar } from './components/PlayerBar'
import { Reader } from './components/Reader'
import { SettingsPanel } from './components/SettingsPanel'
import { TranslationPicker } from './components/TranslationPicker'
import { parseChapter } from './content'
import { useAsync } from './hooks'
import { toBcp47 } from './lang'
import { hashFor, LAST_KEY, navigate, useRoute } from './route'
import { useSettings } from './settings'
import { save } from './storage'
import { rememberTranslation } from './translations'

type Panel = 'passage' | 'translation' | 'settings' | null

export default function App() {
  const ref = useRoute()
  const [settings, update] = useSettings()
  const [panel, setPanel] = useState<Panel>(null)
  const closePanel = useCallback(() => setPanel(null), [])

  const { data, error, loading, retry } = useAsync(hashFor(ref), () => fetchChapter(ref))
  const parsed = useMemo(() => (data ? parseChapter(data.chapter.content) : null), [data])
  const verseTexts = useMemo(() => parsed?.verses.map((v) => v.text) ?? [], [parsed])

  const title = data ? `${data.book.name} ${data.chapter.number}` : ''
  // While the next chapter loads, `data` still holds the previous one, so its links would be stale.
  const next = (!loading && data?.nextChapterReference) || null
  const previous = (!loading && data?.previousChapterReference) || null

  useEffect(() => {
    if (!data || loading) return
    save(LAST_KEY, ref)
    document.title = `${title} · ${data.translation.shortName || data.translation.name}`
  }, [data, loading, ref, title])

  // Start each chapter at the top.
  useEffect(() => window.scrollTo(0, 0), [ref.translationId, ref.book, ref.chapter])

  const goNext = useCallback(() => next && navigate(next), [next])
  const goPrevious = useCallback(() => previous && navigate(previous), [previous])

  const player = usePlayer({
    chapter: loading ? null : data,
    verses: verseTexts,
    title,
    settings,
    onEnded: () => {
      if (!settings.continueToNext || !next) return false
      navigate(next)
      return true
    },
    onNext: goNext,
    onPrevious: goPrevious,
  })
  const playing = player.state.status === 'playing' || player.state.status === 'loading'
  const readingIndex = player.state.status === 'idle' ? -1 : player.state.index
  const { following, resume } = useAutoscroll(readingIndex, settings.autoscroll, playing)

  // Clicking a verse while audio is active jumps playback to it.
  const { play } = player
  const onVerseClick = useCallback((index: number) => play(index), [play])

  // Arrow keys turn pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel || e.altKey || e.ctrlKey || e.metaKey) return
      if ((e.target as HTMLElement).closest('input, select, textarea')) return
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrevious()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, goNext, goPrevious])

  const selectTranslation = async (t: Translation) => {
    setPanel(null)
    rememberTranslation(t.id)
    // Stay on the same chapter if the new translation has it.
    let target: ChapterRef = { ...ref, translationId: t.id }
    try {
      const books = await fetchBooks(t.id)
      const book = books.find((b) => b.id === ref.book)
      if (!book) {
        const first = [...books].sort((a, b) => a.order - b.order)[0]
        target = { translationId: t.id, book: first.id, chapter: first.firstChapterNumber ?? 1 }
      } else if (ref.chapter > (book.firstChapterNumber ?? 1) + book.numberOfChapters - 1) {
        target = { ...target, chapter: book.firstChapterNumber ?? 1 }
      }
    } catch {
      // Fall through: the chapter load will surface any error.
    }
    navigate(target)
  }

  const selectPassage = (r: ChapterRef) => {
    setPanel(null)
    navigate(r)
  }

  const translation = data?.translation

  return (
    <div className={`app${settings.redLetters ? ' red-letters' : ''}${settings.showVerseNumbers ? '' : ' hide-verse-numbers'}`}>
      <header className="app-header">
        <div className="header-inner">
          <button className="pill passage-pill" onClick={() => setPanel('passage')} aria-label="Choose book and chapter">
            <span className="pill-text">{title || '…'}</span>
            <Icon name="chevronDown" />
          </button>
          <button
            className="pill"
            onClick={() => setPanel('translation')}
            title={translation?.name}
            aria-label={`Translation: ${translation?.name ?? ref.translationId}. Change translation`}
          >
            <span className="pill-text">{translation?.shortName || translation?.name || ref.translationId}</span>
            <Icon name="chevronDown" />
          </button>
          <span className="spacer" />
          <button className="icon-button" onClick={() => setPanel('settings')} aria-label="Reading settings">
            <span className="aa" aria-hidden="true">Aa</span>
          </button>
        </div>
      </header>

      <main className={`content${loading ? ' is-loading' : ''}`}>
        {error ? (
          <div className="message">
            <p>Couldn't load this chapter.</p>
            <p className="muted">{error.message}</p>
            <div className="message-actions">
              <button className="button" onClick={retry}>Try again</button>
              <button className="button secondary" onClick={() => setPanel('passage')}>Choose another chapter</button>
            </div>
          </div>
        ) : data && parsed ? (
          <>
            <Reader
              title={title}
              blocks={parsed.blocks}
              footnotes={data.chapter.footnotes ?? []}
              dir={data.translation.textDirection}
              lang={toBcp47(data.translation.language)}
              currentIndex={readingIndex}
              onVerseClick={player.state.status === 'idle' ? undefined : onVerseClick}
            />
            <nav className="chapter-nav">
              <button className="button secondary" onClick={goPrevious} disabled={!previous}>
                <Icon name="chevronLeft" /> Previous
              </button>
              <button className="button secondary" onClick={goNext} disabled={!next}>
                Next <Icon name="chevronRight" />
              </button>
            </nav>
            <footer className="attribution">
              {data.translation.name}.{' '}
              {data.translation.licenseUrl && (
                <a href={data.translation.licenseUrl} target="_blank" rel="noreferrer">License</a>
              )}
              {' · '}Text from the{' '}
              <a href="https://bible.helloao.org" target="_blank" rel="noreferrer">Free Use Bible API</a>
            </footer>
          </>
        ) : (
          <div className="skeleton" aria-label="Loading">
            <div className="skeleton-title" />
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="skeleton-line" style={{ width: `${70 + ((i * 37) % 30)}%` }} />
            ))}
          </div>
        )}
      </main>

      {!following && (
        <button className="follow-button" onClick={resume}>
          <Icon name="follow" /> Follow along
        </button>
      )}

      {data && (
        <PlayerBar
          player={player}
          settings={settings}
          update={update}
          verseCount={parsed?.verses.length ?? 0}
          languageName={translation?.languageEnglishName ?? 'this language'}
          loading={loading}
          onPrevious={previous ? goPrevious : undefined}
          onNext={next ? goNext : undefined}
        />
      )}

      {panel === 'passage' && <PassagePicker current={ref} onSelect={selectPassage} onClose={closePanel} />}
      {panel === 'translation' && (
        <TranslationPicker currentId={ref.translationId} onSelect={selectTranslation} onClose={closePanel} />
      )}
      {panel === 'settings' && <SettingsPanel settings={settings} update={update} onClose={closePanel} />}
    </div>
  )
}
