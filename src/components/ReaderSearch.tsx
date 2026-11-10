import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from 'react'
import type { Book } from '../api'
import { isTouchScreen } from '../device'
import { Icon } from './Icon'

// Searching from the reader without leaving it: the header becomes a search box, and the
// results (a typed reference, verses with the words typed, words to study) open under it. Only
// picking a result goes anywhere. The search code comes with word study, loaded when first used.
const SearchResults = lazy(() => import('../wordstudy/SearchResults'))

export function ReaderSearch({ input, books, translationId, onClose }: {
  /** Focused by the caller in the same tap that opens the search, so a phone shows its keyboard. */
  input: RefObject<HTMLInputElement | null>
  books?: Book[]
  translationId: string
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const area = useRef<HTMLDivElement>(null)

  // A tap outside (on the page) closes it, as does Escape.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!area.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div ref={area} className="reader-search">
      <form
        className="ws-search"
        role="search"
        onSubmit={(e) => {
          // Enter alone never leaves the page; on a phone it puts the keyboard away.
          e.preventDefault()
          if (isTouchScreen()) input.current?.blur()
        }}
      >
        <Icon name="search" />
        <input
          ref={input}
          type="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="John 3:16, for God so loved, mercy…"
          aria-label="Search for a passage, verses or a word"
          aria-autocomplete="list"
          aria-controls="ws-suggestions"
        />
        <Suspense fallback={null}>
          <SearchResults
            query={query}
            input={input}
            books={books}
            translationId={translationId}
            remember={false}
            onPicked={onClose}
            footer={{ hash: '#/study', label: 'Word study', hint: 'Hebrew and Greek words' }}
          />
        </Suspense>
      </form>
      <button type="button" className="link reader-search-cancel" onClick={onClose}>
        Cancel
      </button>
    </div>
  )
}
