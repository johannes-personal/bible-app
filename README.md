# Bible

A simple, login-free Bible reader with listen-along audio.

**Live:** https://the-bible-reader.vercel.app

- **1,200+ translations** in hundreds of languages, searchable and grouped by language (your browser's languages first, then English and Swedish).
- **Book and chapter picker**, previous/next chapter buttons, and ←/→ keyboard shortcuts.
- **Reading view** with section headings, poetry layout, footnotes, optional red letters, adjustable text size and light/sepia/dark themes.
- **Listen along** with a per-chapter progress bar you can drag to seek:
  - Recorded human narration with verse-level timings where available (e.g. the Berean Standard Bible).
  - The device's own text-to-speech voice for every other translation, in the translation's language.
  - The verse being read is highlighted and **auto-scrolls** into view. Scroll by hand and it pauses following until you tap **Follow along**.
  - Tap any verse while audio is active to jump there. Speed control, lock-screen controls, and optional continue-to-next-chapter.

Where you left off, and your settings, are remembered in the browser. Links such as `#/BSB/JHN/3` point to a chapter.

## Data sources

- **[Free Use Bible API](https://bible.helloao.org)** by AO Lab: openly licensed translations (BSB, WEB, KJV, NET, Folkbibeln, …) and recorded narration with verse timings for some of them. No key; called straight from the browser.
- **[YouVersion Platform](https://developers.youversion.com)**: the Bibles available to our app key, including licensed ones like NIV. Called through `api/yv.ts`, a Vercel function that adds the key from the `YOUVERSION_APP_KEY` environment variable so it never reaches the browser. Non-commercial use only.
- **[Bible Brain](https://www.faithcomesbyhearing.com/bible-brain/developer-documentation)** by Faith Comes By Hearing: recorded narration, often with verse timings, and a few translations that come with it (such as the Herziene Statenvertaling). Called through `api/bb.ts`, which adds the key from the `BIBLE_BRAIN_KEY` environment variable. Audio is streamed, never offered for download, and only for personal, non-commercial use.

The catalogues are merged per language (`src/youversion/merge.ts`, `src/biblebrain/merge.ts`). YouVersion comes first: a translation both it and the Free Use Bible API carry gets a YouVersion id (like `yv-3034` for the BSB) and is read from YouVersion, while the Free Use Bible API adds its recorded narration and stands in when YouVersion can't be reached. Translations only the Free Use Bible API has keep its ids (like `eng_kjv`). A Bible Brain recording of a translation the app already has is offered as an extra narrator; Bible Brain Bibles with text and narration that match nothing are added with ids like `bb-NLDHSV`. YouVersion passage HTML and Bible Brain verses are converted into the Free Use Bible API's chapter format. Without the functions or keys (e.g. under `npm run dev`), the app only shows the Free Use Bible API.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run lint       # oxlint
npm run build      # static site in dist/
```

The build is a fully static site with relative paths, so `dist/` can be hosted anywhere: Vercel, Netlify, GitHub Pages, or any static file server.

## Deployment and releases

- The site is hosted on Vercel, which deploys `main` to https://the-bible-reader.vercel.app on every push.
- To cut a release, bump the `version` in `package.json` and add a matching section to `CHANGELOG.md`, then merge to `main`. The Release workflow sees the new version, tags it (e.g. `v1.1.0`) and publishes a GitHub release with the built site attached.

## Project layout

```
src/
  api.ts               Free Use Bible API client and types
  content.ts           Chapter content → paragraphs, poetry, footnotes, and plain text for speech
  route.ts             URL hash routing (#/translation/book/chapter)
  settings.ts          Persisted reader and audio settings
  audio/engines.ts     Narration (mp3 + verse timings) and speech-synthesis engines
  audio/usePlayer.ts   Picks a voice source and drives the active engine
  audio/useAutoscroll.ts  Keeps the current verse in view
  components/          Header pickers, reader, player bar, settings
```
