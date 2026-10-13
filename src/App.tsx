import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchBooks, fetchChapter, fetchCrossRefs, fetchTranslations, findTranslation, type Book, type ChapterRef, type Translation } from './api'
import { relatedVerses } from './crossrefs'
import type { VerseRange } from './references'
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
import { languageKey, languageNames, toBcp47 } from './lang'
import { chapterOf, FALLBACK_TRANSLATION, hashFor, LAST_KEY, navigate, replaceRoute, useRoute } from './route'
import { isYouVersionId } from './youversion/api'
import { useSettings } from './settings'
import { save } from './storage'
import { rememberTranslation } from './translations'

type Panel = 'passage' | 'translation' | 'settings' | null

const NO_BOOKS: Book[] = []
const NO_RELATED = new Map<number, VerseRange[]>()

export default function App() {
  const ref = useRoute()
  const [settings, update] = useSettings()
  const [panel, setPanel] = useState<Panel>(null)
  const closePanel = useCallback(() => setPanel(null), [])

  // Keyed by chapter only, so following a reference within the chapter doesn't reload it.
  const { data, error, loading, retry } = useAsync(hashFor(chapterOf(ref)), () => fetchChapter(chapterOf(ref)))
  const parsed = useMemo(() => (data ? parseChapter(data.chapter.content) : null), [data])
  const verseTexts = useMemo(() => parsed?.verses.map((v) => v.text) ?? [], [parsed])

  const title = data ? `${data.book.name} ${data.chapter.number}` : ''

  // Cross references for the chapter; useAsync keeps the previous chapter's while loading,
  // so only use them once they match the chapter on screen.
  const { data: crossRefs } = useAsync(
    settings.relatedVerses ? `xref/${ref.book}/${ref.chapter}` : null,
    () => fetchCrossRefs(ref.book, ref.chapter),
  )
  const related = useMemo(() => {
    if (!settings.relatedVerses || !crossRefs || !data) return NO_RELATED
    if (crossRefs.book !== data.book.id || crossRefs.chapter !== data.chapter.number) return NO_RELATED
    const map = new Map<number, VerseRange[]>()
    for (const [verse, refs] of crossRefs.byVerse) {
      const list = relatedVerses(refs)
      if (list.length) map.set(verse, list)
    }
    return map
  }, [settings.relatedVerses, crossRefs, data])

  // Book names of the current translation, for recognising references in footnotes.
  const { data: books } = useAsync(ref.translationId, () => fetchBooks(ref.translationId))

  // The merged catalogue names shared translations the way YouVersion does (e.g. "SKB"),
  // so prefer its entry over the chapter's own metadata once it has loaded.
  const { data: catalog } = useAsync('catalog', fetchTranslations)
  const translation = data && (findTranslation(catalog, data.translation.id) ?? data.translation)

  // Older links and saved positions use the Free Use Bible API id (e.g. "BSB") for translations
  // that now come from YouVersion; switch those to the YouVersion id once the catalogue knows it.
  useEffect(() => {
    const t = findTranslation(catalog, ref.translationId)
    if (t && t.id !== ref.translationId) replaceRoute({ ...ref, translationId: t.id })
  }, [catalog, ref])
  // While the next chapter loads, `data` still holds the previous one, so its links would be stale.
  const next = (!loading && data?.nextChapterReference) || null
  const previous = (!loading && data?.previousChapterReference) || null

  // Save the chapter (and any verse it was opened at) once it has loaded. Only on load:
  // after that, scrolling keeps the saved verse up to date (below).
  useEffect(() => {
    if (!data || loading) return
    save(LAST_KEY, ref.verse ? { ...chapterOf(ref), verse: ref.verse } : chapterOf(ref))
    // `ref` is the route that loaded `data`.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading])

  useEffect(() => {
    if (data && !loading) document.title = `${title} · ${translation?.shortName || translation?.name}`
  }, [data, loading, title, translation])

  // Remember the reading position as the chapter plus the first verse at the top of the screen.
  useEffect(() => {
    if (!data || loading) return
    const chapter = chapterOf(ref)
    let timer: ReturnType<typeof setTimeout> | undefined
    const saveTopVerse = () => {
      const top = document.querySelector('.app-header')?.getBoundingClientRect().bottom ?? 0
      const verses = document.querySelectorAll<HTMLElement>('.reader .verse')
      const first = [...verses].find((v) => v.getBoundingClientRect().bottom > top + 8)
      const verse = Number(first?.dataset.verse)
      save(LAST_KEY, verse > 1 ? { ...chapter, verse } : chapter)
    }
    const onScroll = () => {
      clearTimeout(timer)
      timer = setTimeout(saveTopVerse, 250)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
    // Re-bind per chapter; `ref` changes identity on every navigation.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loading, ref.translationId, ref.book, ref.chapter])

  // Start each chapter at the top, or at the verse a link points to (briefly highlighted).
  useEffect(() => {
    if (!ref.verse) {
      window.scrollTo(0, 0)
      return
    }
    if (loading || !data) return
    const el = document.getElementById(`v${ref.verse}`)
    if (!el) return
    if (ref.resume) {
      // Back to where reading stopped: that verse at the top, under the header.
      el.scrollIntoView({ block: 'start' })
      return
    }
    el.scrollIntoView({ block: 'center' })
    el.classList.add('flash')
    const timer = setTimeout(() => el.classList.remove('flash'), 2500)
    return () => {
      clearTimeout(timer)
      el.classList.remove('flash')
    }
  }, [ref.translationId, ref.book, ref.chapter, ref.verse, ref.resume, loading, data])

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
              {isYouVersionId(ref.translationId) && (
                <button
                  className="button secondary"
                  onClick={() => navigate({ ...chapterOf(ref), translationId: FALLBACK_TRANSLATION })}
                >
                  Read in {FALLBACK_TRANSLATION} instead
                </button>
              )}
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
              translationId={data.translation.id}
              bookId={data.book.id}
              related={related}
              books={books ?? NO_BOOKS}
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
              {data.translation.source === 'youversion' ? (
                <>
                  {data.translation.copyright && <p className="copyright">{data.translation.copyright}</p>}
                  {data.translation.name}
                  {' · '}Text from{' '}
                  <a href={data.translation.website} target="_blank" rel="noreferrer">YouVersion</a>
                </>
              ) : (
                <>
                  {translation?.name ?? data.translation.name}.{' '}
                  {data.translation.licenseUrl && (
                    <a href={data.translation.licenseUrl} target="_blank" rel="noreferrer">License</a>
                  )}
                  {' · '}Text from the{' '}
                  <a href="https://bible.helloao.org" target="_blank" rel="noreferrer">Free Use Bible API</a>
                </>
              )}
              {related.size > 0 && (
                <p className="credit">
                  Related verses from{' '}
                  <a href="https://www.openbible.info/labs/cross-references/" target="_blank" rel="noreferrer">
                    OpenBible.info
                  </a>{' '}
                  (CC BY 4.0)
                </p>
              )}
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
          languageName={(translation && languageNames(languageKey(translation.language)).english) || translation?.languageEnglishName || 'this language'}
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
