import { useSyncExternalStore } from 'react'
import { fetchTranslations } from '../api'
import { DATA_CACHE, FREE_API, loadSaved, storeSaved, type Saved } from './saved'
import { splitTranslation, type CompleteTranslation } from './split'

// Saving things on the device for reading without a connection: whole translations from the
// Free Use Bible API, and the word study data. Saving carries on when the screen that started
// it closes, so its progress lives here rather than in a component.

/** Offline reading needs the service worker, which only the built app has. */
export const offlineSupported =
  import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof caches !== 'undefined'

/** The key of the word study data among the things being saved. */
export const WORD_STUDY = 'word-study'

export interface Job {
  /** 0 to 1, or null while the size isn't known yet. */
  progress: number | null
  detail: string
  error?: string
}

interface State {
  saved: Saved
  /** Saving in progress (or failed), by Free Use Bible API id or WORD_STUDY. */
  jobs: Record<string, Job>
}

let state: State = { saved: loadSaved(), jobs: {} }
const listeners = new Set<() => void>()
const controllers = new Map<string, AbortController>()

function set(next: State) {
  state = next
  for (const listener of listeners) listener()
}
const setSaved = (change: (saved: Saved) => Saved) => {
  const saved = change(state.saved)
  storeSaved(saved)
  set({ ...state, saved })
}
const setJob = (key: string, job: Job | null) => {
  const jobs = { ...state.jobs }
  if (job) jobs[key] = job
  else delete jobs[key]
  set({ ...state, jobs })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** What's saved and what's being saved; re-renders as either changes. */
export const useOffline = () => useSyncExternalStore(subscribe, () => state)

/** Runs a save under `key`, with progress, cancelling and a message if it fails. */
async function run(key: string, task: (signal: AbortSignal, report: (progress: number | null, detail: string) => void) => Promise<void>) {
  if (controllers.has(key)) return
  const controller = new AbortController()
  controllers.set(key, controller)
  let last = 0
  const report = (progress: number | null, detail: string) => {
    // Often enough to look alive, not on every chunk received.
    const now = Date.now()
    if (now - last < 150 && progress !== 1) return
    last = now
    setJob(key, { progress, detail })
  }
  setJob(key, { progress: null, detail: 'Starting' })
  try {
    // Ask the browser not to clear this site's storage when space runs low.
    void navigator.storage?.persist?.().catch(() => {})
    await task(controller.signal, report)
    setJob(key, null)
  } catch (error) {
    if (controller.signal.aborted) setJob(key, null)
    else setJob(key, { progress: null, detail: '', error: navigator.onLine ? (error as Error).message : "You're offline." })
  } finally {
    controllers.delete(key)
  }
}

export const cancelSaving = (key: string) => {
  controllers.get(key)?.abort()
  if (!controllers.has(key)) setJob(key, null) // a failed one: just clear its message
}

async function readJson<T>(response: Response, onBytes: (bytes: number) => void): Promise<T> {
  if (!response.body) return (await response.json()) as T
  const reader = response.body.getReader()
  const chunks: BlobPart[] = []
  let bytes = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    bytes += value.length
    onBytes(bytes)
  }
  return JSON.parse(await new Blob(chunks).text()) as T
}

/** Fetches a translation's whole text and stores it as the answers the app asks the API for. */
async function storeTranslation(freeId: string, signal: AbortSignal, report: (progress: number | null, detail: string) => void) {
  const response = await fetch(`${FREE_API}/api/${freeId}/complete.json`, { signal })
  if (!response.ok) throw new Error(`The download failed (${response.status}).`)
  const complete = await readJson<CompleteTranslation>(response, (bytes) => report(null, `${(bytes / 1e6).toFixed(1)} MB`))
  const files = splitTranslation(complete)
  const cache = await caches.open(DATA_CACHE)
  const headers = { 'Content-Type': 'application/json' }
  for (let i = 0; i < files.length; i += 40) {
    signal.throwIfAborted()
    await Promise.all(files.slice(i, i + 40).map((f) => cache.put(FREE_API + f.path, new Response(JSON.stringify(f.body), { headers }))))
    report(Math.min(1, (i + 40) / files.length), 'Saving')
  }
}

/** The id a translation is read under, when the catalogue reads it from another source (the BSB as "yv-3034"). */
const aliasOf = (freeId: string) =>
  fetchTranslations().then(
    (list) => list.find((t) => t.freeId === freeId && t.id !== freeId)?.id,
    () => undefined,
  )

/** Saves a whole translation of the Free Use Bible API for reading without a connection. */
export const saveTranslation = (freeId: string, name: string) =>
  run(freeId, async (signal, report) => {
    await storeTranslation(freeId, signal, report)
    const alias = await aliasOf(freeId)
    setSaved((saved) => ({ ...saved, translations: { ...saved.translations, [freeId]: { name, savedAt: Date.now(), alias } } }))
  })

async function deleteByPrefix(prefix: string) {
  const cache = await caches.open(DATA_CACHE)
  const requests = (await cache.keys()).filter((r) => r.url.startsWith(prefix))
  for (let i = 0; i < requests.length; i += 50) await Promise.all(requests.slice(i, i + 50).map((r) => cache.delete(r)))
}

export async function removeTranslation(freeId: string) {
  controllers.get(freeId)?.abort()
  setSaved((saved) => {
    const translations = { ...saved.translations }
    delete translations[freeId]
    return { ...saved, translations }
  })
  await deleteByPrefix(`${FREE_API}/api/${freeId}/`).catch(() => {})
}

const wordStudyBase = () => new URL('word-study/', document.baseURI)

/** The word study data's files and their size together (written at build time). */
export async function wordStudyFiles(signal?: AbortSignal): Promise<{ files: string[]; bytes: number }> {
  const response = await fetch(new URL('files.json', wordStudyBase()), { signal })
  if (!response.ok) throw new Error("The word study data's list couldn't be loaded.")
  return (await response.json()) as { files: string[]; bytes: number }
}

/**
 * Saves the word study data, and the BSB (whose text the verses are shown in), for studying
 * without a connection. A verse's Hebrew or Greek words still need one, unless that chapter's
 * have been looked at before.
 */
export const saveWordStudy = () =>
  run(WORD_STUDY, async (signal, report) => {
    const { files } = await wordStudyFiles(signal)
    const withBsb = !state.saved.translations.BSB
    const share = withBsb ? 0.75 : 1
    const cache = await caches.open(DATA_CACHE)
    const queue = [...files]
    let done = 0
    await Promise.all(
      Array.from({ length: 6 }, async () => {
        for (let file = queue.shift(); file; file = queue.shift()) {
          const url = new URL(file, wordStudyBase()).href
          const response = await fetch(url, { signal })
          if (!response.ok) throw new Error(`The download failed (${response.status}).`)
          await cache.put(url, response)
          done++
          report((done / files.length) * share, 'Word study data')
        }
      }),
    )
    if (withBsb) {
      await storeTranslation('BSB', signal, (progress, detail) => report(share + (progress ?? 0) * (1 - share), `Berean Standard Bible · ${detail}`))
      const alias = await aliasOf('BSB')
      setSaved((saved) => ({ ...saved, translations: { ...saved.translations, BSB: { name: 'BSB', savedAt: Date.now(), alias } } }))
    }
    setSaved((saved) => ({ ...saved, wordStudy: { savedAt: Date.now() } }))
  })

export async function removeWordStudy() {
  controllers.get(WORD_STUDY)?.abort()
  setSaved((saved) => ({ translations: saved.translations }))
  await deleteByPrefix(wordStudyBase().href).catch(() => {})
}

/**
 * Drops records of things the browser has since cleared (it may, when the device runs out of
 * space), so nothing is shown as saved that isn't.
 */
export async function checkSaved() {
  if (!offlineSupported) return
  const cache = await caches.open(DATA_CACHE)
  const has = async (url: string) => !!(await cache.match(url))
  for (const freeId of Object.keys(state.saved.translations)) {
    if (!(await has(`${FREE_API}/api/${freeId}/books.json`))) {
      setSaved((saved) => {
        const translations = { ...saved.translations }
        delete translations[freeId]
        return { ...saved, translations }
      })
    }
  }
  if (state.saved.wordStudy && !(await has(new URL('names.json', wordStudyBase()).href))) {
    setSaved((saved) => ({ translations: saved.translations }))
  }
}
