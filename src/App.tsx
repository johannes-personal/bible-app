import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { fetchBooks, fetchChapter, fetchCrossRefs, fetchTranslations, findTranslation, type Book, type ChapterRef, type Translation } from './api'
import { relatedVerses } from './crossrefs'
import type { VerseRange } from './references'
import { useAutoscroll } from './audio/useAutoscroll'
import { usePlayer } from './audio/usePlayer'
import { Icon } from './components/Icon'
import { ParallelPane } from './components/ParallelPane'
import { PassagePicker } from './components/PassagePicker'
import { PlayerBar } from './components/PlayerBar'
import { ReaderSearch } from './components/ReaderSearch'
import type { Anchor } from './components/Popover'
import { Reader, type ParallelText } from './components/Reader'
import { StudyBar } from './components/StudyBar'
import { VerseWordsPopover } from './components/VerseWords'
import { SettingsPanel } from './components/SettingsPanel'
import { TranslationPicker } from './components/TranslationPicker'
import { parseChapter } from './content'
import { useAsync, useMediaQuery } from './hooks'
import { languageKey, languageNames, toBcp47 } from './lang'
import { chapterOf, FALLBACK_TRANSLATION, hashFor, LAST_KEY, navigate, replaceRoute, useRoute } from './route'
import { BB_NARRATOR } from './biblebrain/api'
import { isYouVersionId } from './youversion/api'
import { useSettings } from './settings'
import { useSwipe } from './swipe'
import { save } from './storage'
import { clearStudyReturn, loadStudyReturn } from './studyReturn'
import { rememberTranslation } from './translations'
import { verseOffset, versesOfBsb } from './versification'

type Panel = 'passage' | 'translation' | 'parallel' | 'settings' | null

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

  // A second translation beside the first, when chosen (and different).
  const parallelId = settings.parallel && settings.parallel !== ref.translationId ? settings.parallel : null
  const parallelRef = parallelId ? { translationId: parallelId, book: ref.book, chapter: ref.chapter } : null
  const second = useAsync(parallelRef ? hashFor(parallelRef) : null, () => fetchChapter(parallelRef!))
  const { data: secondBooks } = useAsync(parallelId, () => fetchBooks(parallelId!))
  const secondData =
    second.data && second.data.book.id === ref.book && second.data.chapter.number === ref.chapter && second.data.translation.id === parallelId
      ? second.data
      : null
  const secondParsed = useMemo(() => (secondData ? parseChapter(secondData.chapter.content) : null), [secondData])

  // Book names of the current translation, for recognising references in footnotes.
  const { data: books } = useAsync(ref.translationId, () => fetchBooks(ref.translationId))

  // The merged catalogue names shared translations the way YouVersion does (e.g. "SKB"),
  // so prefer its entry over the chapter's own metadata once it has loaded.
  const { data: catalog } = useAsync('catalog', fetchTranslations)
  const translation = data && (findTranslation(catalog, data.translation.id) ?? data.translation)
  const secondTranslation = parallelId ? (findTranslation(catalog, parallelId) ?? secondData?.translation) : null
  const hasBibleBrainAudio = !!data && Object.keys(data.thisChapterAudioLinks ?? {}).some((n) => n.startsWith(BB_NARRATOR))

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
      const verses = document.querySelectorAll<HTMLElement>('.reader .verse[data-verse]')
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
  useSwipe({
    enabled: settings.swipeChapters && !panel,
    rtl: data?.translation.textDirection === 'rtl',
    onNext: goNext,
    onPrevious: goPrevious,
  })

  // Previous/Next, shown above and below the chapter.
  const chapterNav = (position: 'top' | 'bottom') => (
    <nav className={`chapter-nav ${position}`} aria-label={position === 'top' ? 'Chapter navigation' : undefined}>
      <button className="button secondary" onClick={goPrevious} disabled={!previous}>
        <Icon name="chevronLeft" /> Previous
      </button>
      <button className="button secondary" onClick={goNext} disabled={!next}>
        Next <Icon name="chevronRight" />
      </button>
    </nav>
  )

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

  // A verse's original words, from its number or a long press.
  const [verseWords, setVerseWords] = useState<{ verse: number; anchor: Anchor } | null>(null)
  const onVerseWords = useCallback((verse: number, anchor: Anchor) => setVerseWords({ verse, anchor }), [])
  const closeVerseWords = useCallback(() => setVerseWords(null), [])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setVerseWords(null)
  }, [ref.translationId, ref.book, ref.chapter])
  const verseCount = parsed?.verses.at(-1)?.number ?? 0

  // Opened from word study: mark the word's verses here and offer the way back, until the
  // reader moves to another chapter or the bar is dismissed.
  const [study, setStudy] = useState(loadStudyReturn)
  useEffect(() => {
    if (study && (study.book !== ref.book || study.chapter !== ref.chapter)) {
      clearStudyReturn()
      // oxlint-disable-next-line react/set-state-in-effect
      setStudy(null)
    }
  }, [study, ref.book, ref.chapter])
  const closeStudy = useCallback(() => {
    clearStudyReturn()
    setStudy(null)
  }, [])
  const { data: studyMarks } = useAsync(
    study ? `marks/${JSON.stringify(study.word)}/${study.book}/${study.chapter}` : null,
    () => import('./wordstudy/marks').then((m) => m.chapterMarks(study!.word, study!.book, study!.chapter)),
  )
  const isBsb = translation?.id === 'BSB' || translation?.freeId === 'BSB'
  const marks = useMemo(() => {
    if (!study || !studyMarks || !data || studyMarks.book !== data.book.id || studyMarks.chapter !== data.chapter.number) return undefined
    const offset = verseOffset(data.book.id, verseCount, studyMarks.bsbVerseCount)
    return {
      verses: new Set(studyMarks.verses.flatMap((v) => versesOfBsb(v, offset))),
      phrases: isBsb ? studyMarks.phrases : null,
      strongs: new Set(studyMarks.strongs),
    }
  }, [study, studyMarks, data, verseCount, isBsb])
  // Steps through the marked verses in order, starting from the first one not yet scrolled
  // past (under the bar), and wraps around.
  const lastMarked = useRef(0)
  useEffect(() => {
    lastMarked.current = 0
  }, [ref.book, ref.chapter])
  const nextMarkedVerse = useCallback(() => {
    const verses = [...document.querySelectorAll<HTMLElement>('.reader .verse.studied')]
    const number = (v: HTMLElement) => Number(v.dataset.verse)
    const target =
      (lastMarked.current
        ? verses.find((v) => number(v) > lastMarked.current)
        : verses.find((v) => v.getBoundingClientRect().bottom > (document.querySelector('.study-bar')?.getBoundingClientRect().bottom ?? 0))) ??
      verses[0]
    if (!target) return
    lastMarked.current = number(target)
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    for (const v of document.querySelectorAll('.reader .verse.flash')) v.classList.remove('flash')
    void target.offsetWidth // restart the animation
    target.classList.add('flash')
  }, [])

  // Searching from the header, without leaving the chapter. The box is focused in the same tap
  // that opens it, which is what lets a phone bring up its keyboard.
  const [searching, setSearching] = useState(false)
  const searchInput = useRef<HTMLInputElement>(null)
  const openSearch = useCallback(() => {
    void import('./wordstudy/SearchResults') // so the results come up quickly
    flushSync(() => setSearching(true))
    searchInput.current?.focus()
  }, [])
  const closeSearch = useCallback(() => setSearching(false), [])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    setSearching(false)
  }, [ref.translationId, ref.book, ref.chapter, ref.verse])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || panel || searching || e.ctrlKey || e.metaKey || e.altKey) return
      if ((e.target as HTMLElement).closest('input, select, textarea')) return
      e.preventDefault()
      openSearch()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel, searching, openSearch])

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

  const shortName = (t: Translation | null | undefined, fallback: string) => t?.shortName || t?.name || fallback
  const firstName = shortName(translation, ref.translationId)
  const secondName = parallelId ? shortName(secondTranslation, parallelId) : ''
  const firstLabel = useMemo(
    () => (
      <button className="parallel-pick" onClick={() => setPanel('translation')} aria-label={`Translation: ${firstName}. Change translation`}>
        {firstName}
        <Icon name="chevronDown" />
      </button>
    ),
    [firstName],
  )
  const parallel = useMemo((): ParallelText | undefined => {
    if (!parallelId) return undefined
    return {
      label: (
        <>
          <button
            className="parallel-pick"
            onClick={() => setPanel('parallel')}
            aria-label={`Second translation: ${secondName}. Change it`}
          >
            {secondName}
            <Icon name="chevronDown" />
          </button>
          <button className="icon-button parallel-close" aria-label="Close the second translation" onClick={() => update({ parallel: null })}>
            <Icon name="close" />
          </button>
        </>
      ),
      blocks: secondParsed?.blocks ?? [],
      footnotes: secondData?.chapter.footnotes ?? [],
      translationId: parallelId,
      books: secondBooks ?? NO_BOOKS,
      dir: secondData?.translation.textDirection ?? 'ltr',
      lang: secondData ? toBcp47(secondData.translation.language) : undefined,
      message: second.error
        ? `${secondName} doesn't have ${title || 'this chapter'}, or it couldn't be loaded.`
        : !secondData
          ? `Loading ${secondName}…`
          : undefined,
    }
  }, [parallelId, secondName, secondParsed, secondData, secondBooks, second.error, title, update])

  // On phones the second translation gets the bottom half of the screen instead of a column.
  const narrow = useMediaQuery('(max-width: 719px)')
  const split = !!parallel && narrow
  const firstVerseNumbers = useMemo(() => parsed?.verses.map((v) => v.number) ?? [], [parsed])
  const secondVerseNumbers = useMemo(() => secondParsed?.verses.map((v) => v.number) ?? [], [secondParsed])

  const selectParallel = (t: Translation) => {
    setPanel(null)
    rememberTranslation(t.id)
    update({ parallel: t.id })
  }

  const selectPassage = (r: ChapterRef) => {
    setPanel(null)
    navigate(r)
  }

  return (
    <div className={`app${settings.redLetters ? ' red-letters' : ''}${settings.showVerseNumbers ? '' : ' hide-verse-numbers'}`}>
      <header className="app-header">
        <div className="header-inner">
          {searching ? (
            <ReaderSearch input={searchInput} books={books ?? undefined} translationId={ref.translationId} onClose={closeSearch} />
          ) : (
            <>
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
          <button className="study-link" onClick={openSearch} aria-label="Search" title="Search passages, verses and words (/)">
            <Icon name="search" />
            <span>Search</span>
          </button>
          <button className="icon-button" onClick={() => setPanel('settings')} aria-label="Reading settings">
            <span className="aa" aria-hidden="true">Aa</span>
          </button>
            </>
          )}
        </div>
      </header>

      <main className={`content${loading ? ' is-loading' : ''}${parallel && !split ? ' wide' : ''}${split ? ' split' : ''}`}>
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
            {study && (
              <StudyBar study={study} count={marks ? marks.verses.size : null} onNext={nextMarkedVerse} onClose={closeStudy} />
            )}
            {chapterNav('top')}
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
              onVerseWords={onVerseWords}
              longPress={settings.longPressWords}
              marks={marks}
              parallel={split ? undefined : parallel}
              label={firstLabel}
            />
            {split && parallel && (
              <ParallelPane
                label={parallel.label}
                message={parallel.message}
                book={ref.book}
                firstVerses={firstVerseNumbers}
                secondVerses={secondVerseNumbers}
              >
                {secondParsed && (
                  <Reader
                    secondary
                    title=""
                    blocks={secondParsed.blocks}
                    footnotes={parallel.footnotes}
                    dir={parallel.dir}
                    lang={parallel.lang}
                    currentIndex={-1}
                    translationId={parallel.translationId}
                    bookId={ref.book}
                    books={parallel.books}
                    related={NO_RELATED}
                  />
                )}
              </ParallelPane>
            )}
            {verseWords && (
              <VerseWordsPopover
                verse={verseWords.verse}
                anchor={verseWords.anchor}
                bookId={data.book.id}
                bookName={data.book.name}
                chapter={data.chapter.number}
                verseCount={verseCount}
                current={marks?.strongs}
                onClose={closeVerseWords}
              />
            )}
            {chapterNav('bottom')}
            <footer className="attribution">
              {data.translation.source === 'youversion' || data.translation.source === 'biblebrain' ? (
                <>
                  {data.translation.copyright && <p className="copyright">{data.translation.copyright}</p>}
                  {translation?.name ?? data.translation.name}
                  {' · '}Text from{' '}
                  <a href={data.translation.website} target="_blank" rel="noreferrer">
                    {data.translation.source === 'youversion' ? 'YouVersion' : 'Bible Brain (Faith Comes By Hearing)'}
                  </a>
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
              {hasBibleBrainAudio && data.translation.source !== 'biblebrain' && (
                <p className="credit">
                  Recorded narration from{' '}
                  <a href={`https://live.bible.is/bible/${translation?.bibleBrainId ?? ''}`} target="_blank" rel="noreferrer">
                    Faith Comes By Hearing
                  </a>
                </p>
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
        <TranslationPicker
          currentId={ref.translationId}
          onSelect={selectTranslation}
          onClose={closePanel}
          extra={
            <div className="side-by-side">
              {parallelId ? (
                <>
                  <Icon name="columns" />
                  <span className="side-by-side-text">
                    Side by side with <strong>{secondName}</strong>
                  </span>
                  <button className="link" onClick={() => setPanel('parallel')}>Change</button>
                  <button className="link" onClick={() => update({ parallel: null })}>Turn off</button>
                </>
              ) : (
                <button className="button secondary" onClick={() => setPanel('parallel')}>
                  <Icon name="columns" /> Add a second translation side by side
                </button>
              )}
            </div>
          }
        />
      )}
      {panel === 'parallel' && (
        <TranslationPicker
          title="Second translation"
          currentId={parallelId ?? ref.translationId}
          onSelect={selectParallel}
          onClose={closePanel}
          extra={
            parallelId && (
              <div className="side-by-side">
                <Icon name="columns" />
                <span className="side-by-side-text">
                  Beside <strong>{firstName}</strong>
                </span>
                <button
                  className="link"
                  onClick={() => {
                    update({ parallel: null })
                    setPanel(null)
                  }}
                >
                  Turn off side by side
                </button>
              </div>
            )
          }
        />
      )}
      {panel === 'settings' && (
        <SettingsPanel
          settings={settings}
          update={update}
          onClose={closePanel}
          parallelName={parallelId ? secondName : null}
          onChooseParallel={() => setPanel('parallel')}
        />
      )}
    </div>
  )
}
