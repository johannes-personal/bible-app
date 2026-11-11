// Renders the app icons in public/icons from the artwork below (the favicon's book and cross).
// Needs Playwright with Chromium, which isn't a project dependency:
//
//   npx playwright install chromium && node scripts/make-icons.mjs
//
// - icon-192.png, icon-512.png: rounded, for browsers' install dialogs and desktop.
// - maskable-512.png: square and full-bleed, for Android (which cuts its own shape); the artwork
//   stays inside the middle 80%.
// - apple-touch-icon.png (180): square and full-bleed, as iOS rounds the corners itself.

import path from 'node:path'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const OUT = path.resolve(import.meta.dirname, '../public/icons')

const art = (radius) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
    <rect width="64" height="64" rx="${radius}" fill="#8b4f1d"/>
    <path d="M18 14h24a4 4 0 0 1 4 4v32H22a4 4 0 0 1-4-4z" fill="#fbfaf7"/>
    <path d="M31 21v16M25 27h12" stroke="#8b4f1d" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`

const icons = [
  ['icon-192.png', 192, 14],
  ['icon-512.png', 512, 14],
  ['maskable-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
]

const browser = await chromium.launch()
for (const [file, size, radius] of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  await page.setContent(`<body style="margin:0;background:transparent">${art(radius)}</body>`)
  await page.screenshot({ path: path.join(OUT, file), omitBackground: true })
  await page.close()
  console.log(file)
}
await browser.close()
