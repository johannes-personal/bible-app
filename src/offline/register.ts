import { checkSaved, offlineSupported } from './store'

/**
 * Starts the service worker (see pwa/sw.js), which keeps the app and what it reads on the
 * device. Only in the built app; a development server has none.
 */
export function registerServiceWorker() {
  if (!offlineSupported) return
  window.addEventListener('load', () => {
    // A first visit loads its data before the service worker is in charge; once it is, ask
    // for the same things again (the browser has them at hand), so they're kept as well.
    if (!navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', keepWhatWasLoaded, { once: true })
    }
    navigator.serviceWorker.register('./sw.js').catch(() => {})
    void checkSaved().catch(() => {})
  })
}

function keepWhatWasLoaded() {
  const since = performance.now()
  const kept = /^https:\/\/(bible\.helloao\.org|fonts\.googleapis\.com|fonts\.gstatic\.com)\//
  const wordStudy = new URL('word-study/', document.baseURI).href
  const asked = new Set<string>()
  const sweep = () => {
    for (const { name: url, startTime } of performance.getEntriesByType('resource')) {
      // Requests from before the service worker took over; later ones went through it anyway.
      if (startTime >= since || asked.has(url)) continue
      if ((!kept.test(url) && !url.startsWith(wordStudy)) || url.endsWith('/complete.json')) continue
      asked.add(url)
      void fetch(url).catch(() => {})
    }
  }
  // Now, and again for requests that were still under way.
  sweep()
  for (const later of [1500, 5000, 15000]) setTimeout(sweep, later)
}
