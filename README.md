# Bible

A simple, login-free Bible reader with listen-along audio.

**Live:** https://the-bible-reader.vercel.app

- **1,200+ translations** in hundreds of languages, searchable and grouped by language (your browser's languages first, then English and Swedish).
- **Book and chapter picker**, previous/next chapter buttons, and ←/→ keyboard shortcuts.
- **Reading view** with section headings, poetry layout, footnotes, optional red letters, adjustable text size and light/sepia/dark themes.
- **Listen along** with a per-chapter progress bar you can drag to seek:
  - Recorded human narration (e.g. the Berean Standard Bible's three narrators), following along verse by verse. Where a recording comes without verse timings, where each verse starts is estimated from the verses' lengths.
  - The device's own text-to-speech voice for every other translation, in the translation's language.
  - The verse being read is highlighted and **auto-scrolls** into view. Scroll by hand and it pauses following until you tap **Follow along**.
  - Tap any verse while audio is active to jump there. Speed control, lock-screen controls, and optional continue-to-next-chapter.

Where you left off, and your settings, are remembered in the browser. Links such as `#/BSB/JHN/3` point to a chapter, `#/BSB/JHN/3/16` to a verse and `#/BSB/PHP/4/6-7` to a passage.

## Data sources

- **[Free Use Bible API](https://bible.helloao.org)** by AO Lab: openly licensed translations (BSB, WEB, KJV, NET, Folkbibeln, …) and recorded narration for some of them (it stopped publishing the verse timings in November 2026). No key; called straight from the browser.
- **[YouVersion Platform](https://developers.youversion.com)**: the Bibles available to our app key, including licensed ones like NIV. Called through `api/yv.ts`, a Vercel function that adds the key from the `YOUVERSION_APP_KEY` environment variable so it never reaches the browser. Non-commercial use only.
- **[Bible Brain](https://www.faithcomesbyhearing.com/bible-brain/developer-documentation)** by Faith Comes By Hearing: recorded narration, often with verse timings, and a few translations that come with it (such as the Herziene Statenvertaling). Called through `api/bb.ts`, which adds the key from the `BIBLE_BRAIN_KEY` environment variable. Audio is streamed, never offered for download, and only for personal, non-commercial use.

The catalogues are merged per language (`src/youversion/merge.ts`, `src/biblebrain/merge.ts`). YouVersion comes first: a translation both it and the Free Use Bible API carry gets a YouVersion id (like `yv-3034` for the BSB) and is read from YouVersion, while the Free Use Bible API adds its recorded narration and stands in when YouVersion can't be reached. Translations only the Free Use Bible API has keep its ids (like `eng_kjv`). A Bible Brain recording of a translation the app already has is offered as an extra narrator; Bible Brain Bibles with text and narration that match nothing are added with ids like `bb-NLDHSV`. YouVersion passage HTML and Bible Brain verses are converted into the Free Use Bible API's chapter format. Without the functions or keys (e.g. under `npm run dev`), the app only shows the Free Use Bible API.

## Word study

The word study pages (`#/study`) use an index built from the [Berean Standard Bible interlinear](https://bereanbible.com) (public domain, via the Free Use Bible API), where every Hebrew, Aramaic and Greek word carries its Strong's number and the BSB English for it, from the [STEPBible](https://github.com/STEPBible/STEPBible-Data) brief lexicons (CC BY 4.0), and from Strong's Hebrew and Greek dictionaries (public domain; the [Open Scriptures](https://github.com/openscriptures/strongs) XML editions). `node scripts/build-word-study.mjs` downloads them (cached in `.cache/word-study`) and writes `public/word-study/`, which is committed:

- `names.json`: every Hebrew and Greek word with its lemma, transliteration, gloss and count;
- `s/*.json`: per 100 Strong's numbers, each word's English renderings, occurrences and the words most often found in the same verses (by log-likelihood);
- `e/*.json`: per first letter, each English word with its forms and the Strong's numbers it translates.
- `l/*.json`: the same words' lexicon entries (part of speech, pronunciation, root, Strong's definition, KJV renderings, and the STEPBible senses with verse references).

## Inspiration

The inspiration button in the header opens inspiration mode (`#/inspire`, or `#/inspire/hope` for a topic): one verse at a time, full screen over a drawn landscape, scrolled through like a feed. Each card links to its chapter in the reader, opening at the passage (highlighted), and can be shared or saved as a 1080 × 1920 image.

- **The verses** (`src/inspiration/verses.json`) are chosen by `node scripts/build-inspiration.mjs` from [OpenBible.info's topical Bible](https://www.openbible.info/topics/) (CC BY 4.0): people's votes for the verses that fit topics such as "hope", "anxiety" or "gods love". Each of the app's ten topics (Hope, Peace, Strength, Love, Comfort, Joy, Faith, Guidance, Grace, Gratitude) gathers a handful of theirs. Passages must read on their own in the BSB (`public/word-study/text.txt`): start and end a sentence (those that stop mid-sentence are extended to the end of it), be short, and stay clear of judgement and violence. Topics then take turns picking their best-voted passage, so all are well represented.
- **Three tiers:** the first 400 picks (tier 1) and the next 700 (tier 2) were read through by hand; what doesn't stand on its own is listed in the script's `EXCLUDED`. Tier 3 (about 210) takes only what passes stricter checks.
- **True to their chapter:** a card should make the reader want to read the chapter, and the chapter should bear out what the card seemed to say. So the review also takes out verses whose usual reading differs from what they mean where they stand (Jeremiah 29:11, written to exiles about a return 70 years away; Matthew 18:20, about settling disputes), promises tied to one person or moment (Abram, Cyrus, Israel's harvests), the advice of Job's friends, and verses whose "he" or "her" is in another verse. A few are shown with the verse that gives their sense (Philippians 4:12–13, 1 Corinthians 2:9–10). Near-repeats (the gospels' parallel sayings, a psalm's refrain) appear once. The feed shows all of tier 1, in a random order, before any of tier 2, and tier 2 before tier 3. Verses seen are remembered on the device (`bible:inspiration-seen`), so none comes back until everything in the topic has been seen.
- **The text** is the translation being read, fetched like a chapter (passages its books don't have are left out). Psalm titles and "Selah" are left off, and quotation marks the passage leaves open are closed.
- **The backgrounds** (`src/inspiration/art.ts`) are drawn on a canvas, in fourteen kinds: a sunrise, clouds with light breaking through, a still lake, a misty forest, a meadow, a winding path, rain (or a rainbow), hills, mountains, the sea, a night sky, dunes and an evening valley. The build script picks the kind from the passage's words where they paint a picture ("still waters" a lake, "eagles' wings" the sky, "a lamp to my feet" a path, "I will lie down and sleep" the night), otherwise from its topic. The passage seeds the colours and details, so it always looks the same, on screen and in the saved image (`src/inspiration/image.ts`), where the verse is set in Playfair Display.

## Installing and reading offline

The app can be added to a phone's home screen (or installed on a computer), where it opens full screen, and it keeps working without a connection:

- `public/manifest.webmanifest` and the icons in `public/icons/` (made by `scripts/make-icons.mjs`) describe the installed app.
- `pwa/sw.js` is the service worker. The build (`vite.config.ts`) writes it to `dist/sw.js` with the list of the app's own files, which it keeps on the device, so the app opens offline. A new build installs alongside the old one and takes over the next time the app is opened.
- Whatever the app reads from the Free Use Bible API (chapters, book lists, cross references, the interlinear), the word study data and the fonts are kept as they are used, and served from the device first.
- A whole translation can be saved from the translation list: its `complete.json` is fetched once and split into the per-chapter answers the app asks for (`src/offline/`). The word study data can be saved from its start page (the build lists its files in `word-study/files.json`).
- From `/api/` (YouVersion, Bible Brain) only the lists of translations are kept (names and abbreviations), so the app doesn't wait for them each time it starts. Bible text from there is never kept: the licences don't clearly allow storing it, so those translations need a connection. `KEEP_API` in `pwa/sw.js` is the one switch for that.

The service worker only runs in the built app (`npm run build && npm run preview`), not on the development server.

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
  audio/engines.ts     Narration (mp3 + verse timings, or estimated ones) and speech-synthesis engines
  audio/usePlayer.ts   Picks a voice source and drives the active engine
  audio/useAutoscroll.ts  Keeps the current verse in view
  components/          Header pickers, reader, player bar, settings
  inspiration/         Inspiration mode: the verse list and feed order, card text, drawn scenes, images
```
