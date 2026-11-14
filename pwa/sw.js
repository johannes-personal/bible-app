// The service worker: lets the app open, and read what it has kept, without a connection.
// vite.config.ts writes this file to the build as sw.js, filling in the two values below.
//
// What is kept on the device:
// - The app itself (its files are listed at build time), so it opens offline.
// - What it reads from the Free Use Bible API (chapters, book lists, cross references, the
//   interlinear), the word study data and the fonts, each as it is used. The page also puts
//   whole translations and the word study data here when the reader asks (src/offline/store.ts).
//
// - The lists of translations from /api/ (YouVersion's and Bible Brain's catalogues: names and
//   abbreviations, no Bible text), so the app doesn't wait for them each time it starts.
//
// What is never kept: Bible text from /api/ (YouVersion and Bible Brain). Their licences don't
// clearly allow storing it, so those translations need a connection. To change that, see
// KEEP_API below.

const VERSION = '__VERSION__'
const PRECACHE = /* __PRECACHE__ */ []

const SHELL = `bible-shell-${VERSION}`
/** Also written by the page: keep the name in step with src/offline/saved.ts. */
const DATA = 'bible-data-v1'
const FONTS = 'bible-fonts-v1'
/** Whether Bible text from /api/ (YouVersion, Bible Brain) may be kept for offline reading. */
const KEEP_API = false

const SCOPE = self.registration.scope
const BASE = new URL(SCOPE).pathname

// A copy without the "redirected" flag, which browsers refuse as the answer to a navigation.
const clean = async (response) =>
  response.redirected ? new Response(await response.blob(), { status: response.status, headers: response.headers }) : response

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL)
      // '' is the page itself; always a fresh copy of it.
      await Promise.all(
        ['', ...PRECACHE].map(async (file) => {
          const url = new URL(file, SCOPE).href
          const response = await fetch(url, file ? {} : { cache: 'no-cache' })
          if (!response.ok) throw new Error(`${url}: ${response.status}`)
          await cache.put(url, await clean(response))
        }),
      )
    })(),
  )
})

// A new version waits until the app is closed, so a running page keeps the files it started
// with. Once it takes over, earlier versions' files go.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('bible-shell-') && name !== SHELL) await caches.delete(name)
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') return event.respondWith(page(request))
    if (url.pathname.startsWith(`${BASE}api/`)) {
      if (url.searchParams.has('catalog')) return event.respondWith(keptFirst(event, DATA, true, isJson))
      if (KEEP_API) event.respondWith(freshFirst(event, DATA))
      return
    }
    if (url.pathname.startsWith(`${BASE}word-study/`)) {
      // The list of its files is only for saving them all: always the current one.
      if (url.pathname.endsWith('/files.json')) return
      return event.respondWith(keptFirst(event, DATA, true))
    }
    return event.respondWith(appFile(request))
  }

  if (url.hostname === 'bible.helloao.org') {
    // Whole translations are split up by the page instead of being kept as one large file.
    if (url.pathname.endsWith('/complete.json')) return
    return event.respondWith(keptFirst(event, DATA, true))
  }
  if (url.hostname === 'fonts.googleapis.com') return event.respondWith(keptFirst(event, FONTS, true))
  if (url.hostname === 'fonts.gstatic.com') return event.respondWith(keptFirst(event, FONTS, false))
  // Everything else (audio, other sites) goes straight to the network.
})

/** The page: the newest from the network; the kept copy when offline or when that takes long. */
async function page(request) {
  const network = fetch(request)
  const slow = new Promise((_, reject) => setTimeout(reject, 4000))
  try {
    return await Promise.race([network, slow])
  } catch {
    return (await caches.match(SCOPE, { ignoreVary: true })) ?? network
  }
}

/** The app's own files: named after their contents, so a kept copy is always right. */
async function appFile(request) {
  return (await caches.match(request, { ignoreVary: true })) ?? fetch(request)
}

/** Where there's no /api/ (a plain file server), its paths answer with the page instead. */
const isJson = (response) => !!response.headers.get('Content-Type')?.includes('json')

/**
 * The kept copy at once, when there is one. With `refresh`, a newer copy is fetched alongside
 * for next time (text and data); without, a kept copy is final (font files). `keep` can turn
 * an answer down.
 */
async function keptFirst(event, cacheName, refresh, keep = () => true) {
  const { request } = event
  const cache = await caches.open(cacheName)
  const kept = await cache.match(request, { ignoreVary: true })
  if (kept && !refresh) return kept
  const network = fetch(request).then(async (response) => {
    if (response.ok && keep(response)) await cache.put(request, response.clone())
    return response
  })
  if (!kept) return network
  event.waitUntil(network.catch(() => {}))
  return kept
}

/** The network's answer, kept for when there's no connection. */
async function freshFirst(event, cacheName) {
  const { request } = event
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok && isJson(response)) event.waitUntil(cache.put(request, response.clone()))
    return response
  } catch (error) {
    const kept = await cache.match(request, { ignoreVary: true })
    if (kept) return kept
    throw error
  }
}
