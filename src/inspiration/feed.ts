import { load, save } from '../storage'
import { SCENE_KINDS, type SceneKind } from './art'
import data from './verses.json'

// What inspiration mode shows next. The verses come in three tiers (see
// scripts/build-inspiration.mjs): all of tier 1 is shown before any of tier 2, and tier 2
// before tier 3, each in a random order. Seen verses are remembered on the device, so nothing
// comes back until everything (in the chosen topic) has been seen; then it starts over.

export const TOPICS = data.topics as Topic[]
export type Topic = 'hope' | 'peace' | 'strength' | 'love' | 'comfort' | 'joy' | 'faith' | 'guidance' | 'grace' | 'gratitude'

export const TOPIC_LABELS: Record<Topic, string> = {
  hope: 'Hope',
  peace: 'Peace',
  strength: 'Strength',
  love: 'Love',
  comfort: 'Comfort',
  joy: 'Joy',
  faith: 'Faith',
  guidance: 'Guidance',
  grace: 'Grace',
  gratitude: 'Gratitude',
}

export interface Passage {
  /** "JHN.3.16" or "PHP.4.6-7". */
  key: string
  book: string
  chapter: number
  first: number
  last: number
  tier: 1 | 2 | 3
  topics: Topic[]
  /** The kind of background that suits it. */
  scene?: SceneKind
}

type Row = [string, number, number, number, number, number, string]

const isScene = (s: string): s is SceneKind => (SCENE_KINDS as readonly string[]).includes(s)

export const PASSAGES: Passage[] = (data.verses as Row[]).map(([book, chapter, first, last, tier, mask, scene]) => ({
  key: `${book}.${chapter}.${first}${last > first ? `-${last}` : ''}`,
  book,
  chapter,
  first,
  last,
  tier: tier as Passage['tier'],
  topics: TOPICS.filter((_, i) => mask & (1 << i)),
  scene: isScene(scene) ? scene : undefined,
}))

export const isTopic = (s: string | null | undefined): s is Topic => !!s && (TOPICS as string[]).includes(s)

const SEEN_KEY = 'bible:inspiration-seen'

/** The keys of the passages seen, oldest first. */
export const loadSeen = (): string[] => load<string[]>(SEEN_KEY, [])

export function markSeen(key: string) {
  const seen = loadSeen().filter((k) => k !== key)
  seen.push(key)
  save(SEEN_KEY, seen)
}

/** Fisher–Yates, with a random source that tests can fix. */
export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * The order to show `passages` in: unseen ones by tier, shuffled within each tier. Once all
 * have been seen, a new round: everything again, the longest unseen first (by tier), the most
 * recently seen held back to the end.
 */
export function feedOrder(passages: Passage[], seen: string[], random: () => number = Math.random): Passage[] {
  const seenAt = new Map(seen.map((k, i) => [k, i]))
  const unseen = passages.filter((p) => !seenAt.has(p.key))
  const byTier = (list: Passage[]) => [1, 2, 3].flatMap((tier) => shuffle(list.filter((p) => p.tier === tier), random))
  if (unseen.length) {
    // The rest follow once these run out, least recently seen first.
    const again = passages.filter((p) => seenAt.has(p.key)).sort((a, b) => seenAt.get(a.key)! - seenAt.get(b.key)!)
    return [...byTier(unseen), ...again]
  }
  // Everything has been seen: start over, keeping the last fifth seen for the end.
  const recent = [...passages].sort((a, b) => seenAt.get(a.key)! - seenAt.get(b.key)!)
  const holdBack = Math.floor(recent.length / 5)
  const held = recent.slice(recent.length - holdBack)
  return [...byTier(recent.slice(0, recent.length - holdBack)), ...held]
}

/** The passages for a topic (or all), limited to the books a translation has. */
export function passagesFor(topic: Topic | null, books?: Set<string> | null): Passage[] {
  return PASSAGES.filter((p) => (!topic || p.topics.includes(topic)) && (!books || books.has(p.book)))
}
