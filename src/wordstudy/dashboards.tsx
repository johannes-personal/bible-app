import { useEffect, useMemo, useState } from 'react'
import { useAsync } from '../hooks'
import { replaceHash, studyHash } from '../route'
import {
  formatCount,
  LANGUAGE_NAMES,
  loadEnglish,
  loadMeta,
  loadNames,
  loadWord,
  occurrencesOf,
  verseKey,
  type Meta,
  type NameEntry,
  type Occurrence,
  type WordEntry,
} from './data'
import { EnglishLinks } from './bridge'
import { Explorer } from './explorer'
import { LexiconCard } from './lexicon'
import { inScope, scopeLabel, type Mode, type Scope } from './scope'
import { Card, FilterChip, Folded, ModeToggle, RankedList, Stats } from './ui'
import { VerseList } from './verses'

// The two dashboards: one for a Hebrew or Greek word, one for an English word. Each has the
// "Where it's used" explorer, lists that filter the verses, and the verses themselves. The
// explorer, lists and verses all follow the same filters, so they always agree.

/** Categorical colours for an English word's original words, in fixed order; the rest are "Other". */
const SERIES_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)']
const OTHER_COLOR = 'var(--series-other)'

const verseCount = (os: Occurrence[]) => new Set(os.map(verseKey)).size

function OriginalLabel({ name, detail }: { name: NameEntry; detail?: string }) {
  const [lemma, translit, gloss, , lang] = name
  return (
    <>
      <span className="ws-lemma" lang={lang === 'g' ? 'grc' : 'he'}>{lemma}</span> {translit}{' '}
      <span className="muted">
        {gloss}
        {detail && ` · ${detail}`}
      </span>
    </>
  )
}

export function Loading() {
  return <p className="muted ws-loading">Loading…</p>
}

export function NotFound({ what, english }: { what: string; english?: boolean }) {
  return (
    <div className="message">
      <p>Nothing found for {what}.</p>
      {english && (
        <p className="muted">
          The search covers words the Berean Standard Bible uses to translate a Hebrew or Greek word. Try another form
          of the word, or a related one.
        </p>
      )}
      <a className="button secondary" href={studyHash({ kind: 'home' })}>Back to word study</a>
    </div>
  )
}

// -----------------------------------------------------------------------------------------------
// A Hebrew or Greek word

export function WordPage({ strongs }: { strongs: string }) {
  const { data, error } = useAsync(`ws-word-${strongs}`, () => Promise.all([loadMeta(), loadNames(), loadWord(strongs)]))
  if (error) return <p className="message">{error.message}</p>
  if (!data) return <Loading />
  const [meta, names, word] = data
  if (!names[strongs]) return <NotFound what={strongs} />
  return <WordDashboard strongs={strongs} meta={meta} names={names} word={word ?? UNUSED} />
}

/** A dictionary word the BSB's tagging never uses: it still has a lexicon entry. */
const UNUSED: WordEntry = { renderings: [], occurrences: [], related: [] }

function WordDashboard({ strongs, meta, names, word }: {
  strongs: string
  meta: Meta
  names: Record<string, NameEntry>
  word: WordEntry
}) {
  const [lemma, translit, gloss, count, lang] = names[strongs]
  const [mode, setMode] = useState<Mode>('count')
  const [scope, setScope] = useState<Scope>({})
  const [rendering, setRendering] = useState<number | null>(null)
  const [together, setTogether] = useState<{ strongs: string; verses: Set<number> } | null>(null)

  const all = useMemo(() => occurrencesOf(strongs, word), [strongs, word])
  // Filters other than the part of the Bible apply to the explorer too.
  const filtered = all.filter((o) => (rendering == null || o.rendering === rendering) && (!together || together.verses.has(verseKey(o))))
  const scoped = filtered.filter((o) => inScope(meta, scope, o))

  const renderingCounts = new Map<number, number>()
  for (const o of all.filter((o) => inScope(meta, scope, o))) renderingCounts.set(o.rendering, (renderingCounts.get(o.rendering) ?? 0) + 1)
  const renderings = word.renderings
    .map(([label], i) => ({ i, label, value: renderingCounts.get(i) ?? 0 }))
    .filter((r) => r.value)
    .sort((a, b) => b.value - a.value)
  const untranslated = renderingCounts.get(-1) ?? 0

  const showTogether = async (other: string) => {
    if (together?.strongs === other) return setTogether(null)
    const entry = await loadWord(other)
    if (entry) setTogether({ strongs: other, verses: new Set(occurrencesOf(other, entry).map(verseKey)) })
  }

  return (
    <article className="ws-page">
      <header className="ws-top">
        <div className="ws-title">
          <p className="ws-kicker">
            {LANGUAGE_NAMES[lang]} · {strongs}
          </p>
          <h1>
            <span className="ws-lemma big" lang={lang === 'g' ? 'grc' : 'he'}>{lemma}</span> {translit}
          </h1>
          <p className="ws-gloss">{gloss}</p>
        </div>
        <Stats items={[[count, 'times'], [verseCount(all), 'verses'], [new Set(all.map((o) => o.book)).size, 'books']]} />
      </header>

      <LexiconCard strongs={strongs} meta={meta} names={names} />

      {all.length === 0 ? (
        <div className="message ws-unused-word">
          <p>The Berean Standard Bible doesn't use this word.</p>
          <p className="muted">
            It's in Strong's dictionary, but the BSB's Hebrew and Greek texts don't have it: it may come from other
            manuscripts, or the BSB tags these verses with a closely related word.
          </p>
        </div>
      ) : (
        <>
          <FilterBar
            count={verseCount(scoped)}
            scope={scope.book != null || scope.section != null ? scopeLabel(meta, scope) : null}
            onClearScope={() => setScope({})}
            chips={[
              rendering != null && { label: `Translated “${word.renderings[rendering][0]}”`, clear: () => setRendering(null) },
              together && { label: `With ${names[together.strongs][1]}`, clear: () => setTogether(null) },
            ]}
            hint="Select a part of the Bible, a translation or a word it's found with to narrow everything down."
          />

          <div className="ws-dash">
            <Card id="where" title="Where it's used" actions={<ModeToggle mode={mode} onChange={setMode} />} className="ws-main-card">
              <Explorer meta={meta} occurrences={filtered} mode={mode} scope={scope} onScope={setScope} />
            </Card>
            <div className="ws-side">
              <Card
                id="renderings"
                title="How it's translated"
                subtitle={`In ${scopeLabel(meta, scope)}. Select a bar to see where the BSB uses it, or a word to study it in English.`}
              >
                <Folded
                  items={renderings}
                  limit={6}
                  render={(items) => (
                    <RankedList
                      items={items.map((r) => ({
                        key: String(r.i),
                        label: <EnglishLinks text={r.label} />,
                        value: r.value,
                        active: rendering === r.i,
                        selectLabel: `Show where it's translated “${r.label}”`,
                        onSelect: () => setRendering(rendering === r.i ? null : r.i),
                      }))}
                    />
                  )}
                />
                {untranslated > 0 && (
                  <p className="muted ws-note">
                    {formatCount(untranslated)} more without an English word of its own (part of a phrase, or grammar).
                  </p>
                )}
              </Card>
              {word.related.length > 0 && (
                <Card
                  id="together"
                  title="Found together with"
                  subtitle="Words in the same verses more often than chance, strongest first. Select one to see the verses with both."
                >
                  <Folded
                    items={word.related.filter(([s]) => names[s])}
                    limit={6}
                    render={(items) => (
                      <RankedList
                        unit="verses"
                        items={items.map(([s, shared]) => ({
                          key: s,
                          href: studyHash({ kind: 'word', strongs: s }),
                          label: <OriginalLabel name={names[s]} />,
                          value: shared,
                          active: together?.strongs === s,
                          selectLabel: `Show the ${shared} verses with both`,
                          onSelect: () => void showTogether(s),
                        }))}
                      />
                    )}
                  />
                </Card>
              )}
            </div>
          </div>

          <Card id="verses" title="Verses" subtitle={versesLabel(verseCount(scoped))}>
            <VerseList
              key={`${scope.section}-${scope.book}-${scope.chapter}-${rendering}-${together?.strongs}`}
              meta={meta}
              occurrences={scoped}
              highlight={(o) => (o.rendering >= 0 ? [word.renderings[o.rendering][0]] : [])}
              current={new Set([strongs])}
              onScope={(s) => {
                setScope(s)
                document.querySelector('.ws-filterbar')?.scrollIntoView({ behavior: 'smooth' })
              }}
            />
          </Card>
        </>
      )}
    </article>
  )
}

// -----------------------------------------------------------------------------------------------
// An English word

export function EnglishPage({ word }: { word: string }) {
  const { data, error } = useAsync(`ws-en-${word}`, async () => {
    const [meta, names, english] = await Promise.all([loadMeta(), loadNames(), loadEnglish(word)])
    if (!english) return { meta, names, english: null, words: [] }
    const words = await Promise.all(english.entry.strongs.map(([s]) => loadWord(s)))
    return { meta, names, english, words }
  })
  useBaseWordAddress(word, data?.english?.lemma)
  if (error) return <p className="message">{error.message}</p>
  if (!data) return <Loading />
  if (!data.english) return <NotFound what={`“${word}”`} english />
  return <EnglishDashboard {...data} english={data.english} />
}

/** A word form ("loving") shows its base word's page ("love"), so the address and trail use it too. */
function useBaseWordAddress(word: string, lemma: string | undefined) {
  useEffect(() => {
    if (lemma && lemma !== word) replaceHash(studyHash({ kind: 'english', word: lemma }))
  }, [word, lemma])
}

function EnglishDashboard({ meta, names, english, words }: {
  meta: Meta
  names: Record<string, NameEntry>
  english: NonNullable<Awaited<ReturnType<typeof loadEnglish>>>
  words: (WordEntry | null)[]
}) {
  const { lemma, entry } = english
  const [mode, setMode] = useState<Mode>('count')
  const [scope, setScope] = useState<Scope>({})
  const [original, setOriginal] = useState<string | null>(null)

  // Every place the BSB uses this English word, with the Hebrew or Greek word behind it.
  const all = useMemo(
    () => entry.strongs.flatMap(([s, , renderings], i) => (words[i] ? occurrencesOf(s, words[i], renderings) : [])),
    [entry, words],
  )
  const perWord = entry.strongs.filter(([s]) => names[s]).map(([s]) => s)
  const top = perWord.slice(0, SERIES_COLORS.length)
  const colorOf = (s: string) => SERIES_COLORS[top.indexOf(s)] ?? OTHER_COLOR
  const series = [
    ...top.map((s, i) => ({ key: s, label: names[s][1], color: SERIES_COLORS[i] })),
    ...(perWord.length > top.length ? [{ key: 'other', label: 'Other', color: OTHER_COLOR }] : []),
  ]
  const seriesOf = (o: Occurrence) => {
    const i = top.indexOf(o.strongs)
    return i >= 0 ? i : top.length
  }

  const filtered = all.filter((o) => !original || o.strongs === original)
  const scoped = filtered.filter((o) => inScope(meta, scope, o))
  const wordCounts = new Map<string, number>()
  for (const o of all.filter((o) => inScope(meta, scope, o))) wordCounts.set(o.strongs, (wordCounts.get(o.strongs) ?? 0) + 1)
  const ranked = perWord.filter((s) => wordCounts.get(s)).sort((a, b) => (wordCounts.get(b) ?? 0) - (wordCounts.get(a) ?? 0))
  const forms = Object.keys(entry.forms)

  return (
    <article className="ws-page">
      <header className="ws-top">
        <div className="ws-title">
          <p className="ws-kicker">English · Berean Standard Bible</p>
          <h1>{lemma}</h1>
          {forms.length > 1 && <p className="ws-gloss">Including {forms.filter((f) => f !== lemma).join(', ')}</p>}
        </div>
        <Stats items={[[all.length, 'times'], [verseCount(all), 'verses'], [perWord.length, 'Hebrew and Greek words']]} />
      </header>

      <FilterBar
        count={verseCount(scoped)}
        scope={scope.book != null || scope.section != null ? scopeLabel(meta, scope) : null}
        onClearScope={() => setScope({})}
        chips={[original ? { label: `From ${names[original][1]}`, clear: () => setOriginal(null) } : null]}
        hint="Select a part of the Bible or a Hebrew or Greek word to narrow everything down."
      />

      <div className="ws-dash">
        <Card id="where" title="Where it's used" actions={<ModeToggle mode={mode} onChange={setMode} />} className="ws-main-card">
          <Explorer
            meta={meta}
            occurrences={filtered}
            mode={mode}
            scope={scope}
            onScope={setScope}
            series={original ? undefined : series}
            seriesOf={seriesOf}
          />
        </Card>
        <div className="ws-side">
          <Card
            id="originals"
            title="Hebrew and Greek words"
            subtitle={`Translated “${lemma}” in ${scopeLabel(meta, scope)}. Select one to see where.`}
          >
            <Folded
              items={ranked}
              limit={6}
              render={(items) => (
                <RankedList
                  items={items.map((s) => ({
                    key: s,
                    href: studyHash({ kind: 'word', strongs: s }),
                    label: <OriginalLabel name={names[s]} detail={LANGUAGE_NAMES[names[s][4]]} />,
                    value: wordCounts.get(s) ?? 0,
                    color: colorOf(s),
                    active: original === s,
                    selectLabel: `Show where ${names[s][1]} is translated “${lemma}”`,
                    onSelect: () => setOriginal(original === s ? null : s),
                  }))}
                />
              )}
            />
          </Card>
          {entry.related.length > 0 && (
            <Card
              id="same-words"
              title="Same words, other English"
              subtitle="Other English words the BSB uses for the same Hebrew and Greek words."
            >
              <ul className="ws-related-english">
                {entry.related.map(([other, shared, via]) => (
                  <li key={other}>
                    <a href={studyHash({ kind: 'english', word: other })}>{other}</a>
                    <span className="muted">
                      {formatCount(shared)}× · via{' '}
                      {via
                        .filter((s, i) => names[s] && via.findIndex((x) => names[x]?.[1] === names[s][1]) === i)
                        .map((s, i) => (
                          <span key={s}>
                            {i > 0 && ', '}
                            <a className="ws-via" href={studyHash({ kind: 'word', strongs: s })}>{names[s][1]}</a>
                          </span>
                        ))}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <Card id="verses" title="Verses" subtitle={versesLabel(verseCount(scoped))}>
        <VerseList
          key={`${scope.section}-${scope.book}-${scope.chapter}-${original}`}
          meta={meta}
          occurrences={scoped}
          highlight={() => forms}
          current={new Set(entry.strongs.map(([s]) => s))}
          tag={(o) => (names[o.strongs] ? <a href={studyHash({ kind: 'word', strongs: o.strongs })}>{names[o.strongs][1]}</a> : null)}
          onScope={(s) => {
            setScope(s)
            document.querySelector('.ws-filterbar')?.scrollIntoView({ behavior: 'smooth' })
          }}
        />
      </Card>
    </article>
  )
}

const versesLabel = (n: number) => `${formatCount(n)} ${n === 1 ? 'verse' : 'verses'}`

/**
 * The filters in effect, above the dashboard and kept in view while scrolling, since they
 * narrow every card on the page.
 */
function FilterBar({ count, scope, onClearScope, chips, hint }: {
  count: number
  scope: string | null
  onClearScope: () => void
  chips: (false | null | { label: string; clear: () => void })[]
  hint: string
}) {
  const active = chips.filter((c): c is { label: string; clear: () => void } => !!c)
  const any = !!scope || active.length > 0
  return (
    <div className={`ws-filterbar${any ? ' active' : ''}`} role="status">
      <span className="ws-filterbar-count">{versesLabel(count)}</span>
      {any ? (
        <>
          {scope && <FilterChip onClear={onClearScope}>In {scope}</FilterChip>}
          {active.map((c) => (
            <FilterChip key={c.label} onClear={c.clear}>{c.label}</FilterChip>
          ))}
          {(scope ? 1 : 0) + active.length > 1 && (
            <button
              className="link ws-clear-all"
              onClick={() => {
                onClearScope()
                active.forEach((c) => c.clear())
              }}
            >
              Clear all
            </button>
          )}
        </>
      ) : (
        <span className="muted ws-filterbar-hint">{hint}</span>
      )}
    </div>
  )
}
