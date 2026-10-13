# Changelog

## 1.3.0

- Footnotes open in a popover (hover on desktop, tap on phones). When a note refers to other verses, such as "Deuteronomy 8:3" or "5 Mos 8:3", the popover shows their full text in the current translation, with a link to read them in context.
- References in the notes at the end of a chapter are links too. Links point at a verse (e.g. `#/BSB/DEU/8/3`), which is scrolled to and briefly highlighted.
- Footnote markers are easier to hover and tap, and Folkbibeln's markers get letters instead of "-".
- Fixes verse numbers overlapping the first word when a poetic passage starts with a prose line, and the translation button being squeezed on narrow screens.
- The app remembers where you were reading, down to the verse at the top of the screen, and opens there again (also after a reload).
- First visits open in the NIV (previously BSB, or Folkbibeln for Swedish browsers). If YouVersion can't be reached, the error page offers the same chapter in BSB.
- More reliable YouVersion loading: the server retries temporary YouVersion errors, and the app tries again instead of silently keeping a list without YouVersion's translations. The translation picker says when they couldn't be loaded and has a "Try again" button.

## 1.2.0

- Adds YouVersion (the source behind bible.com) as a second Bible source: about 950 more translations, including NIV, NASB, Amplified and nuBibeln, for over 2,200 in total.
- Translations both sources carry appear once, with YouVersion's name and abbreviation (e.g. Svenska Kärnbibeln is now "SKB"), and keep their recorded narration where available.
- YouVersion texts show their copyright notice and link to bible.com. They're read aloud with the device voice.

## 1.1.0

- The book picker opens on the current book's chapters; "All books" goes back to the full list.
- The translation picker is grouped like books and chapters: pick a language, then a translation. It opens on the current translation's language, suggests your languages first, and search still finds translations across all languages.

## 1.0.2

- The page now leaves room for the audio options panel, so it no longer covers the chapter's Previous/Next buttons.
- Quoted and poetic verses (e.g. Matthew 5:3) are highlighted in full while being read, not just their verse number, and their verse numbers sit beside the first line again.
- The device voice no longer clips the last word of a sentence at higher speeds.
- "Words of Jesus in red" in reading settings no longer splits into two columns.

## 1.0.1

- Fix a blank screen after choosing another chapter or translation in browsers where `scrollTo()` returns a Promise (recent Chrome and Edge).

## 1.0.0

First release. Live at https://the-bible-reader.vercel.app

**Reading**
- Choose from 1,200+ openly licensed translations, searchable and grouped by language (browser languages first, then English and Swedish), with recently used translations on top.
- Book and chapter picker, previous/next chapter buttons and ←/→ keys; links like `#/BSB/JHN/3` open a chapter directly, and the last chapter read is remembered.
- Reading view with section headings, poetry layout, footnotes, optional red letters, adjustable text size and Auto/Light/Sepia/Dark themes.

**Listening**
- Recorded human narration with per-verse timings where available (e.g. BSB), and the device's text-to-speech in the translation's language everywhere else.
- Per-chapter progress bar with seeking, playback speed, lock-screen controls and optional continue-to-next-chapter.
- The verse being read is highlighted and auto-scrolled into view; scrolling by hand pauses following until you tap "Follow along". Tap a verse to jump playback there.
