import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/** Every file under a directory, as paths relative to it. */
function filesIn(dir: string, prefix = ''): string[] {
  return fs.readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const file = prefix ? `${prefix}/${entry.name}` : entry.name
    return entry.isDirectory() ? filesIn(dir, file) : [file]
  })
}

/**
 * Offline support, added once the build is written:
 * - sw.js, the service worker (from pwa/sw.js), with the list of the app's files to keep on the
 *   device and a version made from them, so each new build installs afresh;
 * - word-study/files.json, the list of word study data files (and their size), for saving all
 *   of it for offline use.
 */
function offline(): Plugin {
  let out = ''
  let root = ''
  return {
    name: 'offline',
    apply: 'build',
    configResolved(config) {
      root = config.root
      out = path.resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      if (!fs.existsSync(path.join(out, 'index.html'))) return
      const all = filesIn(out).sort()

      const study = all.filter((f) => f.startsWith('word-study/') && f !== 'word-study/files.json')
      const bytes = study.reduce((sum, f) => sum + fs.statSync(path.join(out, f)).size, 0)
      if (study.length) {
        fs.writeFileSync(
          path.join(out, 'word-study/files.json'),
          JSON.stringify({ files: study.map((f) => f.slice('word-study/'.length)), bytes }),
        )
      }

      const precache = all.filter((f) => !f.startsWith('word-study/') && f !== 'index.html' && f !== 'sw.js')
      const version = createHash('sha1')
        .update(fs.readFileSync(path.join(out, 'index.html')))
        .update(precache.join('\n'))
        .digest('hex')
        .slice(0, 12)
      const worker = fs
        .readFileSync(path.join(root, 'pwa/sw.js'), 'utf8')
        .replace('__VERSION__', version)
        .replace('/* __PRECACHE__ */ []', JSON.stringify(precache))
      fs.writeFileSync(path.join(out, 'sw.js'), worker)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offline()],
  // Relative asset paths let the build be hosted from any sub-path (e.g. GitHub Pages).
  base: './',
})
