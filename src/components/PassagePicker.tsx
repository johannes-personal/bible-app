import { useMemo, useState } from 'react'
import { fetchBooks, type Book, type ChapterRef } from '../api'
import { chapterNumbers, groupBooks } from '../books'
import { useAsync } from '../hooks'
import { Icon } from './Icon'
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
          placeholder="Search books"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            const first = groups[0]?.books[0]
            if (e.key === 'Enter' && first) pickBook(first)
          }}
          autoFocus
        />
      }
    >
      {loading && !books && <p className="muted center">Loading books…</p>}
      {error && (
        <p className="muted center">
          Couldn't load books. <button className="link" onClick={retry}>Try again</button>
        </p>
      )}
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
