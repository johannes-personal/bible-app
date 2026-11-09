import type { InterlinearWord } from '../api'
import { studyHash } from '../route'
import { EnglishLinks } from './bridge'

/**
 * A verse's Hebrew or Greek words in English order, as chips: the English links to its
 * English study page, the original to its own. Words in `current` are marked.
 */
export function OriginalWordList({ words, current }: { words: InterlinearWord[]; current?: Set<string> }) {
  const shown = words.filter((w) => w.strongs).sort((a, b) => a.bsbPos - b.bsbPos)
  return (
    <ul className="ws-words" aria-label="Original words">
      {shown.map((w, i) => {
        const gloss = w.gloss && !/^[.\s]+$/.test(w.gloss) ? w.gloss : '—'
        return (
          <li key={i} className={current?.has(w.strongs!) ? 'current' : undefined}>
            <span className="ws-word-gloss">
              <EnglishLinks text={gloss} />
            </span>
            <a className="ws-word-link" href={studyHash({ kind: 'word', strongs: w.strongs! })}>
              <span className="ws-word-original" lang={w.language === 'greek' ? 'grc' : 'he'}>{w.text}</span>
              <span className="ws-word-translit">{w.transliteration}</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
