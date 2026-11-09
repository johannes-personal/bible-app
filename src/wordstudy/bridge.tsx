import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { fetchInterlinear, type InterlinearWord } from '../api'
import { useAsync } from '../hooks'
import { studyHash } from '../route'
import { formatCount, LANGUAGE_NAMES, loadEnglish, loadNames } from './data'
import { splitMarked } from './highlight'

// Links between the languages: English words lead to their own study pages, and a word in a
// verse shows the Hebrew or Greek word it translates (from the BSB interlinear).

// Words not worth studying on their own (same idea as the build script's stopwords).
const STOPWORDS = new Set(
  (
    'a an the of and or but nor to in into on onto at by for from with as than then so that this these those ' +
    'is am are was were be been being have has had do does did shall will would should can could may might must ' +
    'i me my mine we us our ours you your yours he him his she her hers it its they them their theirs ' +
    'who whom whose which what not no o oh'
  ).split(' '),
)

const WORD = /[\p{L}][\p{L}'’]*/gu

/** The English word to study for a token: lowercase, without a possessive. */
const englishKey = (token: string) => token.toLowerCase().replace(/['’]s$/, '').replace(/['’]$/, '')

const isStudyWord = (token: string) => {
  const key = englishKey(token)
  return key.length > 1 && !STOPWORDS.has(key)
}

/** Text with each English word worth studying as a link to its page. */
export function EnglishLinks({ text }: { text: string }) {
  const out: ReactNode[] = []
  let at = 0
  for (const m of text.matchAll(WORD)) {
    if (!isStudyWord(m[0])) continue
    out.push(text.slice(at, m.index))
    out.push(
      <a key={m.index} className="ws-en-link" href={studyHash({ kind: 'english', word: englishKey(m[0]) })}>
        {m[0]}
      </a>,
    )
    at = (m.index ?? 0) + m[0].length
  }
  out.push(text.slice(at))
  return <>{out}</>
}

/**
 * Verse text where each word worth studying can be tapped, showing the Hebrew or Greek word
 * behind it and links to study either. `marks` are phrases to highlight.
 */
export function TappableVerse({ text, marks, bookId, chapter, verse }: {
  text: string
  marks: string[]
  bookId: string
  chapter: number
  verse: number
}) {
  const [picked, setPicked] = useState<{ index: number; token: string; anchor: HTMLElement } | null>(null)

  // Highlighted and plain stretches, then the words in each.
  const stretches = splitMarked(text, marks)

  let n = 0
  const words = (s: string) => {
    const out: ReactNode[] = []
    let i = 0
    for (const m of s.matchAll(WORD)) {
      if (!isStudyWord(m[0])) continue
      out.push(s.slice(i, m.index))
      const token = m[0]
      const index = n++
      out.push(
        <button
          key={index}
          type="button"
          className="ws-w"
          aria-haspopup="dialog"
          aria-expanded={picked?.index === index}
          onClick={(e) => setPicked(picked?.index === index ? null : { index, token, anchor: e.currentTarget })}
        >
          {token}
        </button>,
      )
      i = (m.index ?? 0) + m[0].length
    }
    out.push(s.slice(i))
    return out
  }

  return (
    <>
      {stretches.map((s, i) => (s.marked ? <mark key={i}>{words(s.text)}</mark> : <span key={i}>{words(s.text)}</span>))}
      {picked && (
        <WordPanel
          token={picked.token}
          anchor={picked.anchor}
          bookId={bookId}
          chapter={chapter}
          verse={verse}
          onClose={() => setPicked(null)}
        />
      )}
    </>
  )
}

/** The Hebrew or Greek words whose BSB English contains the token. */
function originalsFor(words: InterlinearWord[], token: string): InterlinearWord[] {
  const key = englishKey(token)
  const seen = new Set<string>()
  return words.filter((w) => {
    if (!w.strongs || !w.gloss || seen.has(w.strongs)) return false
    const hit = [...w.gloss.matchAll(WORD)].some((m) => englishKey(m[0]) === key)
    if (hit) seen.add(w.strongs)
    return hit
  })
}

function WordPanel({ token, anchor, bookId, chapter, verse, onClose }: {
  token: string
  anchor: HTMLElement
  bookId: string
  chapter: number
  verse: number
  onClose: () => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const key = englishKey(token)
  const { data } = useAsync(`bridge-${bookId}.${chapter}.${verse}.${key}`, () =>
    Promise.all([fetchInterlinear(bookId, chapter), loadNames(), loadEnglish(key)]),
  )

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.getBoundingClientRect()
      const width = Math.min(340, window.innerWidth - 24)
      const left = Math.min(Math.max(12, a.left + a.width / 2 - width / 2), window.innerWidth - width - 12)
      const height = panel.current?.offsetHeight ?? 0
      const below = a.bottom + 6
      const top = below + height > window.innerHeight - 8 && a.top - 6 - height > 8 ? a.top - 6 - height : below
      setPosition({ top, left, width })
    }
    place()
    window.addEventListener('scroll', place, { passive: true })
    window.addEventListener('resize', place)
    const observer = new ResizeObserver(place)
    if (panel.current) observer.observe(panel.current)
    return () => {
      window.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
      observer.disconnect()
    }
  }, [anchor])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!panel.current?.contains(target) && !anchor.contains(target)) onClose()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [anchor, onClose])

  const [interlinear, names, english] = data ?? []
  const originals = interlinear ? originalsFor(interlinear.get(verse) ?? [], token) : []

  return createPortal(
    <div
      ref={panel}
      className="note-popover ws-word-panel"
      role="dialog"
      aria-label={`“${token}”`}
      style={position ? { top: position.top, left: position.left, width: position.width } : { visibility: 'hidden' }}
    >
      {!data ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          {originals.length > 0 ? (
            originals.map((w) => {
              const name = names?.[w.strongs!]
              return (
                <a key={w.strongs} className="ws-panel-original" href={studyHash({ kind: 'word', strongs: w.strongs! })} onClick={onClose}>
                  <span className="ws-panel-kicker">
                    {name ? LANGUAGE_NAMES[name[4]] : 'Original'} behind “{w.gloss}”
                  </span>
                  <span className="ws-panel-word">
                    <span className="ws-lemma" lang={w.language === 'greek' ? 'grc' : 'he'}>{w.text}</span>{' '}
                    <span className="muted">{w.transliteration}</span>
                  </span>
                  {name && (
                    <span className="ws-panel-gloss">
                      {name[0]} {name[1]} · {name[2]} · {formatCount(name[3])}×
                    </span>
                  )}
                </a>
              )
            })
          ) : (
            <p className="muted ws-panel-note">No Hebrew or Greek word of its own here (part of a phrase, or added for the English).</p>
          )}
          {english && (
            <a className="ws-panel-english" href={studyHash({ kind: 'english', word: english.lemma })} onClick={onClose}>
              Study “{english.lemma}” in English · {formatCount(english.entry.total)}×
            </a>
          )}
        </>
      )}
    </div>,
    document.body,
  )
}
