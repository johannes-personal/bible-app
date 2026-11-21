import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { fetchBooks, fetchChapter, type ChapterRef } from '../api'
import { Icon } from '../components/Icon'
import { useAsync, useOnline } from '../hooks'
import { closeInspiration, DEFAULT_TRANSLATION, hashFor, inspireHash, LAST_KEY, replaceHash } from '../route'
import { loadFont } from '../settings'
import { load } from '../storage'
import { backdropOf, drawScene, sceneFor, type Scene } from './art'
import { feedOrder, isTopic, loadSeen, markSeen, passagesFor, TOPIC_LABELS, TOPICS, type Passage, type Topic } from './feed'
import {
  cardImage,
  fitVerse,
  fontReady,
  IMAGE_WIDTH,
  imageName,
  labelOf,
  LINE_HEIGHT,
  VERSE_FONT,
  VERSE_GOOGLE_FAMILY,
  type CardContent,
} from './image'
import { cardText, passageText, verseTexts } from './text'
import './inspiration.css'

// Inspiration mode: one verse at a time, full screen over a drawn landscape, scrolled through
// like a feed. Each card links to its chapter (opening at the verse) and can be shared or saved
// as an image.

interface Card {
  /** Unique in the feed (a passage can come round again in a long session). */
  id: number
  passage: Passage
  scene: Scene
}

let nextCardId = 1

interface Loaded extends CardContent {
  /** The verse's font size at IMAGE_WIDTH. */
  size: number
}

/** How many cards to add at a time, and how close to the end before adding them. */
const BATCH = 8
const AHEAD = 4

const contents = new Map<string, Promise<Loaded | null>>()

/** A card's words in a translation, or null when the translation doesn't have the passage. */
function loadCard(passage: Passage, translationId: string): Promise<Loaded | null> {
  const key = `${translationId} ${passage.key}`
  let p = contents.get(key)
  if (!p) {
    p = (async () => {
      const ref: ChapterRef = { translationId, book: passage.book, chapter: passage.chapter }
      const [chapter] = await Promise.all([fetchChapter(ref), fontReady()])
      const raw = passageText(verseTexts(chapter.chapter.content), passage.first, passage.last)
      if (!raw) return null
      const verses = passage.last > passage.first ? `${passage.first}–${passage.last}` : `${passage.first}`
      const content: CardContent = {
        text: cardText(raw),
        reference: `${chapter.book.name} ${passage.chapter}:${verses}`,
        translation: chapter.translation.shortName || chapter.translation.name,
      }
      return { ...content, size: fitVerse(content.text).size }
    })()
    p.catch(() => contents.delete(key))
    contents.set(key, p)
  }
  return p
}

/** Where each topic's feed was left, to come back to after reading a verse in context. */
const sessions = new Map<string, { cards: Card[]; order: Passage[]; next: number; current: number }>()

export default function Inspiration({ topic: topicParam }: { topic: string | null }) {
  const topic: Topic | null = isTopic(topicParam) ? topicParam : null
  const translationId = load<ChapterRef | null>(LAST_KEY, null)?.translationId ?? DEFAULT_TRANSLATION
  const sessionKey = `${translationId} ${topic ?? 'all'}`
  const online = useOnline()

  useEffect(() => {
    loadFont({ id: 'inspiration', googleFamily: VERSE_GOOGLE_FAMILY })
    const title = document.title
    document.title = 'Inspiration'
    return () => {
      document.title = title
    }
  }, [])

  // Only passages from books the translation has (a New Testament, say).
  const { data: books, error: booksError } = useAsync(`books ${translationId}`, () => fetchBooks(translationId))
  const bookIds = useMemo(() => (books ? new Set(books.map((b) => b.id)) : null), [books])
  const ready = !!bookIds || !!booksError

  const [cards, setCards] = useState<Card[]>(() => sessions.get(sessionKey)?.cards ?? [])
  const [current, setCurrent] = useState(() => sessions.get(sessionKey)?.current ?? 0)
  const plan = useRef(sessions.get(sessionKey) ? { order: sessions.get(sessionKey)!.order, next: sessions.get(sessionKey)!.next } : null)

  const more = useCallback(
    (count: number) => {
      if (!ready) return
      const pool = passagesFor(topic, bookIds)
      if (!pool.length) return
      let { order, next } = plan.current ?? { order: feedOrder(pool, loadSeen()), next: 0 }
      const added: Card[] = []
      while (added.length < count) {
        if (next >= order.length) {
          // Everything in the topic has come round: a new round.
          order = feedOrder(pool, loadSeen())
          next = 0
        }
        const passage = order[next++]
        added.push({ id: nextCardId++, passage, scene: sceneFor(passage.key) })
      }
      plan.current = { order, next }
      setCards((list) => [...list, ...added])
    },
    [ready, topic, bookIds],
  )

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    if (ready && !cards.length) more(BATCH)
  }, [ready, cards.length, more])

  useEffect(() => {
    if (cards.length && current >= cards.length - AHEAD) more(BATCH)
  }, [current, cards.length, more])

  useEffect(() => {
    if (plan.current) sessions.set(sessionKey, { cards, current, ...plan.current })
  }, [sessionKey, cards, current])

  // A passage the translation doesn't have drops out of the feed.
  const drop = useCallback((key: string) => setCards((list) => list.filter((c) => c.passage.key !== key)), [])

  // Fetch the next few cards' words ahead of time.
  useEffect(() => {
    for (const c of cards.slice(current, current + 3)) void loadCard(c.passage, translationId).catch(() => {})
  }, [cards, current, translationId])

  // Which card fills the screen.
  const feed = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = feed.current
    if (!root) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset.index))
      },
      { root, threshold: 0.6 },
    )
    for (const el of root.querySelectorAll('.inspire-card')) observer.observe(el)
    return () => observer.disconnect()
  }, [cards])

  // Back where the feed was left.
  useLayoutEffect(() => {
    const root = feed.current
    if (root && current) root.scrollTop = current * root.clientHeight
    // Only on opening.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const step = useCallback((by: number) => {
    const root = feed.current
    if (!root) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    root.scrollBy({ top: by * root.clientHeight, behavior: reduce ? 'auto' : 'smooth' })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      if (e.key === 'Escape') closeInspiration()
      else if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j' || (e.key === ' ' && !e.shiftKey)) step(1)
      else if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k' || (e.key === ' ' && e.shiftKey)) step(-1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  const chooseTopic = (t: Topic | null) => {
    if (t !== topic) replaceHash(inspireHash(t))
  }
  const chips = useRef<HTMLDivElement>(null)
  useEffect(() => {
    chips.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [topic])

  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2200)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <div className="inspire">
      <div className="inspire-top">
        <button className="inspire-round" onClick={closeInspiration} aria-label="Close inspiration" title="Close (Esc)">
          <Icon name="close" />
        </button>
        <div className="inspire-topics" ref={chips} role="group" aria-label="Topics">
          <button className="inspire-chip" aria-pressed={!topic} onClick={() => chooseTopic(null)}>
            All
          </button>
          {TOPICS.map((t) => (
            <button key={t} className="inspire-chip" aria-pressed={topic === t} onClick={() => chooseTopic(t)}>
              {TOPIC_LABELS[t]}
            </button>
          ))}
          <a className="inspire-credit" href="https://www.openbible.info/topics/" target="_blank" rel="noreferrer">
            Chosen with OpenBible.info
          </a>
        </div>
      </div>

      <div className="inspire-feed" ref={feed} role="feed" aria-label={topic ? `Verses about ${TOPIC_LABELS[topic].toLowerCase()}` : 'Verses'}>
        {cards.map((card, i) => (
          <VerseCard
            key={card.id}
            card={card}
            index={i}
            near={Math.abs(i - current) <= 1}
            first={i === 0 && current === 0}
            translationId={translationId}
            online={online}
            onMissing={drop}
            onSeen={markSeen}
            active={i === current}
            onToast={setToast}
          />
        ))}
        {!cards.length && (
          <div className="inspire-card inspire-empty">
            <p>{ready ? 'No verses to show for this translation.' : ''}</p>
          </div>
        )}
      </div>
      {toast && (
        <div className="inspire-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function VerseCard({
  card,
  index,
  near,
  first,
  active,
  translationId,
  online,
  onMissing,
  onSeen,
  onToast,
}: {
  card: Card
  index: number
  near: boolean
  first: boolean
  active: boolean
  translationId: string
  online: boolean
  onMissing: (key: string) => void
  onSeen: (key: string) => void
  onToast: (message: string) => void
}) {
  const { passage, scene } = card
  const [attempt, setAttempt] = useState(0)
  const wanted = near || active
  const { data: content, error, loading } = useAsync(wanted ? `${translationId} ${passage.key} ${attempt}` : null, () =>
    loadCard(passage, translationId),
  )

  // The translation doesn't have it: out of the feed.
  useEffect(() => {
    if (wanted && !loading && !error && content === null) onMissing(passage.key)
  }, [wanted, loading, error, content, onMissing, passage.key])

  // Seen once its words have been on screen.
  useEffect(() => {
    if (active && content) onSeen(passage.key)
  }, [active, content, onSeen, passage.key])

  // The scene, drawn at the card's size when it's on or next to the screen.
  const frame = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const el = frame.current
    const c = canvas.current
    if (!near || !el || !c) return
    let drawn = ''
    const draw = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(el.clientWidth * scale)
      const h = Math.round(el.clientHeight * scale)
      if (!w || !h || drawn === `${w}x${h}`) return
      drawn = `${w}x${h}`
      c.width = w
      c.height = h
      drawScene(c.getContext('2d')!, w, h, scene)
    }
    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(el)
    return () => observer.disconnect()
  }, [near, scene])

  const [busy, setBusy] = useState(false)
  const image = async () => (content ? new File([await cardImage(scene, content)], imageName(content.reference), { type: 'image/jpeg' }) : null)

  const share = async () => {
    if (!content || busy) return
    setBusy(true)
    try {
      const file = await image()
      const plain = `${content.text}\n— ${content.reference} (${content.translation})`
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: content.reference })
      } else if (navigator.share) {
        await navigator.share({ title: content.reference, text: plain })
      } else {
        await navigator.clipboard.writeText(plain)
        onToast('Verse copied')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') onToast("Couldn't share this verse")
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!content || busy) return
    setBusy(true)
    try {
      const file = await image()
      if (!file) return
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      onToast("Couldn't save the image")
    } finally {
      setBusy(false)
    }
  }

  const [from, to] = backdropOf(scene)
  const style = { '--from': from, '--to': to } as CSSProperties
  const context = hashFor({
    translationId,
    book: passage.book,
    chapter: passage.chapter,
    verse: passage.first,
    verseEnd: passage.last > passage.first ? passage.last : undefined,
  })

  return (
    <article
      className="inspire-card"
      data-index={index}
      style={style}
      aria-label={content?.reference}
      aria-busy={!content}
    >
      <div className="inspire-frame" ref={frame}>
        {/* Only the cards on and next to the screen keep a drawing (each is a few megabytes). */}
        {near && <canvas className="inspire-art" ref={canvas} aria-hidden="true" />}
        <div className="inspire-words">
          {content ? (
            <>
              <blockquote
                className="inspire-verse"
                style={{ fontSize: `${(content.size / IMAGE_WIDTH) * 100}cqw`, lineHeight: LINE_HEIGHT, fontFamily: VERSE_FONT }}
              >
                {content.text}
              </blockquote>
              <span className="inspire-rule" aria-hidden="true" />
              <p className="inspire-label">{labelOf(content)}</p>
            </>
          ) : error ? (
            <div className="inspire-error">
              <p>{online ? "Couldn't load this verse." : "You're offline. Verses load when there's a connection, or from a translation saved for offline reading."}</p>
              <button className="inspire-pill" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </button>
            </div>
          ) : (
            <span className="inspire-wait" aria-label="Loading" />
          )}
        </div>

        <div className="inspire-actions">
          <button className="inspire-tool" onClick={share} disabled={!content || busy} aria-label="Share this verse">
            <span className="inspire-tool-icon">
              <Icon name="share" />
            </span>
            <span>Share</span>
          </button>
          <a className="inspire-pill inspire-context" href={context}>
            Read in context
            <Icon name="chevronRight" />
          </a>
          <button className="inspire-tool" onClick={save} disabled={!content || busy} aria-label="Save as an image">
            <span className="inspire-tool-icon">
              <Icon name="download" />
            </span>
            <span>Save</span>
          </button>
        </div>
        {first && (
          <div className="inspire-hint" aria-hidden="true">
            <Icon name="chevronDown" />
          </div>
        )}
      </div>
    </article>
  )
}
