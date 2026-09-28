# Changelog

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
