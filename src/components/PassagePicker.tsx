import { Fragment, useEffect, useMemo, useState } from 'react'
import { fetchBooks, type Book, type ChapterRef } from '../api'
import { chapterNumbers, groupBooks } from '../books'
import { useAsync } from '../hooks'
import { parseReference, referenceFinder } from '../references'
import { splitMarked } from '../wordstudy/highlight'
import { Icon } from './Icon'
import { isTouchScreen } from '../device'
import { Sheet } from './Sheet'

interface Props {
  current: ChapterRef
  onSelect: (ref: ChapterRef) => void
  onClose: () => void
}

export function PassagePicker({ current, onSelect, onClose }: Props) {
  const { translationId } = current
  const { data: books, error, loading, retry } = useAsync(translationId, () => fetchBooks(translationId))
  const [query, setQuery] = useState('')
  // Open on the current book's chapters; "All books" goes back to the full list.
  const [bookId, setBookId] = useState<string | null>(current.book)

  const book = books?.find((b) => b.id === bookId) ?? null
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matching = (books ?? []).filter(
      (b) => !q || b.name.toLowerCase().includes(q) || b.commonName.toLowerCase().includes(q) || b.id.toLowerCase().startsWith(q),
    )
    return groupBooks(matching)
  }, [books, query])

  // A reference typed in ("John 3:16", "ps 23"), if this translation has it.
  const finder = useMemo(() => referenceFinder(books ?? []), [books])
  const reference = useMemo(() => {
    const r = parseReference(query, finder)
    const b = r && books?.find((x) => x.id === r.book)
    if (!r || !b) return null
    const first = b.firstChapterNumber ?? 1
    if (r.chapter < first || r.chapter >= first + b.numberOfChapters) return null
    return { ...r, name: b.name }
  }, [query, finder, books])
  const verses = useVerseSearch(reference ? '' : query, books)
  const goToVerse = (v: FoundVerse) => onSelect({ translationId, book: v.book, chapter: v.chapter, verse: v.verse })

  const pickBook = (b: Book) => {
    if (b.numberOfChapters === 1) onSelect({ translationId, book: b.id, chapter: chapterNumbers(b)[0] })
    else setBookId(b.id)
  }

  if (book) {
    return (
      <Sheet
        title={book.name}
        onClose={onClose}
        toolbar={
          <button className="link back" onClick={() => setBookId(null)}>
            <Icon name="back" /> All books
          </button>
        }
      >
        <div className="chapter-grid">
          {chapterNumbers(book).map((n) => {
            const isCurrent = book.id === current.book && n === current.chapter
            return (
              <button
                key={n}
                className={`chapter-cell${isCurrent ? ' selected' : ''}`}
                onClick={() => onSelect({ translationId, book: book.id, chapter: n })}
                aria-current={isCurrent}
              >
                {n}
              </button>
            )
          })}
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet
      title="Books"
      onClose={onClose}
      toolbar={
        <input
          className="search"
          type="search"
          placeholder="Book, reference or words (John 3:16, for God so loved)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (reference) return onSelect({ translationId, book: reference.book, chapter: reference.chapter, verse: reference.verse })
            const first = groups[0]?.books[0]
            if (first) return pickBook(first)
            if (verses?.[0]) goToVerse(verses[0])
          }}
          // Most people tap a book; on touch screens don't cover the list with the keyboard.
          autoFocus={!isTouchScreen()}
        />
      }
    >
      {loading && !books && <p className="muted center">Loading books…</p>}
      {error && (
        <p className="muted center">
          Couldn't load books. <button className="link" onClick={retry}>Try again</button>
        </p>
      )}
      {reference && (
        <button
          className="list-row go-reference"
          onClick={() => onSelect({ translationId, book: reference.book, chapter: reference.chapter, verse: reference.verse })}
        >
          <Icon name="chevronRight" />
          <span className="list-row-main">
            <span className="list-row-title">
              {reference.name} {reference.chapter}
              {reference.verse ? `:${reference.verse}` : ''}
            </span>
          </span>
        </button>
      )}
      {verses && verses.length > 0 && (
        <section>
          <h3 className="group-label">
            Verses <span className="count">matching the BSB's wording</span>
          </h3>
          <ul className="list found-verses">
            {verses.map((v) => (
              <li key={v.code}>
                <button className="list-row" onClick={() => goToVerse(v)}>
                  <span className="list-row-main">
                    <span className="list-row-title">{v.label}</span>
                    <span className="found-verse-text">
                      {splitMarked(v.preview, v.marks).map((p, i) => (
                        <Fragment key={i}>{p.marked ? <mark>{p.text}</mark> : p.text}</Fragment>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {verses?.length === 0 && groups.length === 0 && <p className="muted center">No book or verse matches “{query}”.</p>}
      {groups.map((g) => (
        <section key={g.label}>
          <h3 className="group-label">{g.label}</h3>
          <div className="book-grid">
            {g.books.map((b) => (
              <button
                key={b.id}
                className={`book-cell${b.id === current.book ? ' selected' : ''}`}
                onClick={() => pickBook(b)}
              >
                {b.name}
              </button>
            ))}
          </div>
        </section>
      ))}
    </Sheet>
  )
}

interface FoundVerse {
  code: number
  book: string
  chapter: number
  verse: number
  /** "John 3:16", with this translation's book name. */
  label: string
  preview: string
  marks: string[]
}

/**
 * Verses whose wording matches what's typed (two or more words), best first, from the BSB's
 * text. The word study code that does this is loaded the first time it's needed. Null when
 * there's nothing to search for (yet).
 */
function useVerseSearch(query: string, books: Book[] | null | undefined): FoundVerse[] | null {
  const [found, setFound] = useState<{ query: string; verses: FoundVerse[] } | null>(null)
  const q = query.trim()
  const words = q.split(/\s+/).filter(Boolean)
  const wanted = !!books && words.length >= 2 && !/^\d/.test(q)
  useEffect(() => {
    if (!wanted) return
    let live = true
    const timer = setTimeout(async () => {
      const [phrase, data] = await Promise.all([import('../wordstudy/phrase'), import('../wordstudy/data')])
      const { words } = phrase.parseQuery(q)
      const [meta, text, forms] = await Promise.all([data.loadMeta(), phrase.loadVerseText(), phrase.formsOf(words)])
      if (!live) return
      // The exact wording when some verse has it; otherwise the closest matches.
      const exact = phrase.findPhrase(text, words)
      const matching = exact.length ? exact : phrase.bestMatches(phrase.findAllWords(text, forms), words, forms, 8)
      const marks = exact.length ? [words.join(' ')] : [words.join(' '), ...forms.flat()]
      const verses = matching.slice(0, 8).flatMap((v): FoundVerse[] => {
        const o = data.decodeVerse(v.code)
        const id = meta.books[o.book].id
        const book = books?.find((b) => b.id === id)
        if (!book) return [] // not in this translation
        return [
          {
            code: v.code,
            book: id,
            chapter: o.chapter,
            verse: o.verse,
            label: `${book.name} ${o.chapter}:${o.verse}`,
            preview: phrase.snippet(v.text, words, 140),
            marks,
          },
        ]
      })
      setFound({ query: q, verses: verses.slice(0, 5) })
    }, 200)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [q, wanted, books])
  if (!wanted) return null
  return found?.query === q ? found.verses : null
}
