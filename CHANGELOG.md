# Changelog

## 1.12.1

- Faster start: the chapter shows as soon as its text arrives (about a second), instead of waiting for the list of all translations. YouVersion's part of that list takes several seconds when it isn't cached, which made the first visit after each update take around ten seconds.
  - Recorded narration that comes from another source than the text (such as the BSB's, when it's read from YouVersion) is added once the list is in. The player waits for that briefly, so it still starts with the narration.
- The lists of translations (names and abbreviations, no Bible text) are now kept on the device and refreshed in the background, so the translation list opens at once on later visits, also offline.
- When a chapter can't be loaded, the player no longer stays on the chapter before.

## 1.12.0

- The app can be put on the home screen (iPhone: Share, then "Add to Home Screen"; Android and computers: the browser's "Install"), where it opens full screen with its own icon, without the browser's bars. The reading settings say how.
- It works without a connection:
  - The app itself opens offline.
  - Chapters of free translations stay readable once they've been opened, along with their related verses and Hebrew and Greek words.
  - A free translation can be saved in full: in the translation list, "Save … for reading offline" (the BSB is about 2 MB to download). Saved translations are marked in the list and come first when offline; the reading settings list what's saved, with a way to remove it.
  - Word study can be saved for use offline from its start page (about 30 MB with the BSB's text): searching, the word pages and the verses then work without a connection. A verse's Hebrew or Greek words still need one the first time that chapter's are looked at.
  - Translations from YouVersion (such as the NIV) and Bible Brain still need a connection, as their licences don't clearly allow keeping the text on the device; recorded narration is streamed as before. Reading aloud with the device's voice works offline.
- Offline, a chapter that isn't on the device says so (and how to save a translation), and loads by itself when the connection is back. The header names the chapter and translation that were asked for, also when they couldn't be loaded.
- Chapters, book lists and word study data that have been loaded before now appear at once, and are refreshed in the background.

## 1.11.0

- Recorded audio Bibles are marked in the translation picker with a headphones symbol, and come first: first within each language, and in search results languages that have one come first too. A "With audio" filter (remembered) shows only those. For now that's the Berean Standard Bible and the Accessible Ancients Bible; Bible Brain's recordings join once its key works.
- Search from the reader without leaving the chapter: the header's Search button (or "/" on a keyboard) turns the header into a search box with the keyboard up. Results open under it as you type: a typed reference ("jn 3:16" → Go to John 3:16), the verses that match best, the way to all of them in word study, and words to study. Only tapping a result goes anywhere: a verse or reference opens in the translation being read. Enter on a phone just puts the keyboard away; Cancel, Escape or a tap outside closes the search.
- Search boxes have a ✕ to clear them (keeping the keyboard up), and iPhones no longer zoom in when the search opens.
- Words still being typed are matched as the start of a word: "love one ano" already finds "love one another", marked in full, and "See all" searches for the completed phrase.
- Find a verse by its wording, in the reader: the book picker's search now takes references ("jn 3:16", "1 cor 13:4-7", "Psalm 23") and words ("for God so loved"), listing the verses whose BSB wording matches, best first; tapping one opens it in the translation being read. Enter puts a phone's keyboard away rather than jumping anywhere.
- Word study searches verses by phrase, right in the search box: type two or more words (or a word in quotes) and the five best-matching verses appear in the results under the box, with a reference and the text around the match ("for God so loved" shows John 3:16), then "See all", then matching words. A misremembered quote ("god so love the world") still finds the closest verses. For a single word, "Verses with …" comes after the words.
  - Searching never leaves the page: results open only when one is tapped (or chosen with the arrow keys and Enter). On a phone, the keyboard's Search key just puts the keyboard away; the results stay open until a tap outside, and fit above the keyboard.
  - The verse text starts loading at the second word typed.
  - The results page shows how many verses have the exact phrase and how many have all the words in any order (also in other forms: "love" finds "loved"), and starts on the exact phrase when there is one.
  - The verses come first ("Best matches": exact phrase, or all the words closest together and in order first), then the word breakdown.
  - Like the word pages: where it's used (the drill-down heatmap), the verses with the phrase marked, and filters that narrow both.
  - "Hebrew and Greek behind it": for each word of the phrase, the original words the BSB translates it with in those verses, such as ἀγαπάω *agapaō* behind "love" in 11 of the 13 verses with "love one another". Select one to see just those verses.
  - Opening a verse in the reader marks the verses with the phrase there, and the bar leads back to the search.
  - The search uses the BSB's text (public domain), loaded the first time verses are searched; `scripts/build-verse-text.mjs` builds it.

## 1.10.0

- Side by side on phones: the second translation now has the bottom half of the screen to itself. Each half scrolls on its own and the other follows, to the same verse and as far through it. Read-aloud and autoscroll keep to the top half.
- The translation picker can add a second translation side by side, change it or turn it off; the second translation's picker can turn it off too.
- Moving to another chapter while listening (swiping, Previous/Next, the chapter picker or a headset's skip button) starts reading the new chapter. When paused, it stays paused.
- On phones, the translation and book pickers now stay full height with the keyboard up, instead of stopping at the top of the keyboard with the page showing through behind it; their lists leave room to scroll the last results above the keyboard.

## 1.9.0

- Two translations side by side: choose a second translation in the reading settings ("Side by side"). The chapter is laid out verse by verse, so both scroll together.
  - On wider screens they sit in two columns, under headings that stay in view; tap either heading to change that translation, or ✕ to close the second.
  - On phones each verse is followed by the same verse in the second translation, set in from the left.
  - Psalms whose titles are numbered as verses in one translation and not the other (such as the NBG 1951 beside the BSB) are lined up, and a verse one translation numbers differently stays next to its neighbour.
  - Read-aloud, verse links, related verses and word study marks follow the first translation; the second has its own footnotes.
- Swipe left or right on a touch screen to go to the next or previous chapter (the other way round in right-to-left translations). The text follows your finger; vertical scrolling, short swipes, swipes from the screen's edge and text selection are left alone. It can be turned off in the reading settings.
- Fonts: choose Serif (Literata, as before), Classic (EB Garamond), Sans-serif (Inter) or Legible (Atkinson Hyperlegible) in the reading settings. Text size stays comparable across them.
- On phones, choosing a translation or a book and chapter now takes the whole screen, from the top, and ends where the on-screen keyboard begins, so search results stay in view and can be tapped. The page behind no longer scrolls while it's open. The book search no longer brings up the keyboard on its own on touch screens (the translation search still does); on a computer it still takes typing straight away.
- Pressing and holding a verse for its Hebrew or Greek words is now a setting, off by default, so pressing and holding selects text as usual. Tapping a verse number still shows the words.

## 1.8.0

- From the reader to word study: tap a verse number, or press and hold a verse, to see its Hebrew or Greek words in the order of the English, as in word study. Each word's English links to its English study page, and the original word to its own page. This works in any translation, because it goes by verse; the words come from the BSB interlinear.
  - In translations that number a psalm's title as verse 1 (or 1–2), such as the Dutch NBG 1951, the verses are lined up with the BSB's, with a note saying so.
- From word study to the reader: a chapter opened from a word's page (a verse's "Read" link, or a reference in the lexicon) marks every verse in it that uses the word, and in the BSB the word itself. A bar under the header names the word and leads back to its page. Its verse count steps through the marked verses, and ✕ dismisses it. It goes away on moving to another chapter.
- Popovers open on whichever side of their verse has more room, and stay between the header and the player.

## 1.7.0

- Word study is now a dashboard: an overview that fits on one screen, with collapsible cards.
  - *Where it's used* is a heatmap you drill into: both testaments and their sections at once (each previewing its books), then the books of a section (each previewing its chapters), then a book's chapters. Counts or per 1,000 words.
  - Selecting a part of the Bible, an English rendering, a word it's found together with, or (for English words) a Hebrew or Greek word narrows everything else on the page. The filters in effect show in a bar above the dashboard, which stays in view while scrolling, with the number of verses and a button to clear each (or all).
  - A verse opens in place: the verses around it, its Hebrew or Greek words, and links to read it in the reader or see every occurrence in that book. Each word chip links both ways: its English to the English word's page, the Hebrew or Greek to its own.
- Moving between the languages:
  - Any word in a verse can be tapped to see the Hebrew or Greek word behind it (from the interlinear), with links to study the original or the English word.
  - *How it's translated* links each English word to its page.
  - On English pages, the names in the *Where it's used* legend link to those Hebrew and Greek words' pages.
  - English pages have *Same words, other English*: other English words the BSB uses for the same Hebrew and Greek words (for "love": devotion, kindness, lover, beloved…), each with the original words they share.
  - A trail of the words studied recently, in either language, sits under the search box.
  - A word form ("loving") opens its base word's page ("love").
- Scrolled down a word's page, the header names the word being studied (*חֶסֶד chesed · kindness*, or *love · English*) without getting any taller; tap it to go back to the top. On phones it takes the search box's place, and a search button brings the box back.
- "Found together with" now also counts Hebrew words with prefixes such as "and" or "to", which were left out before (for *chesed*: *emet*, truth, is now the strongest).
- A Hebrew or Greek word's page opens with a *Lexicon* card laid out like a dictionary page: pronunciation, part of speech, dictionary forms, root (a link to that word), Strong's definition and how the KJV translates it, beside the numbered meanings from the STEPBible lexicon, with verse references as links. Long entries fold. Pronunciation, roots and the Strong's and KJV lines come from Strong's dictionaries (public domain).
- A link to the word on Blue Letter Bible (the STEP Bible links didn't find the word).
- Every word in Strong's dictionaries has a page, including the 422 the BSB's Hebrew and Greek texts don't use (from other manuscripts, or tagged under a related word); those show their lexicon entry. Links between words in the lexicon all lead somewhere, and four of Strong's Greek entries that point to Hebrew words (such as *agapaō*'s "compare H5689") now link to the Hebrew word.
- The reader's header has a labelled "Study" button (just the icon on narrow phones).

## 1.6.0

- Word study (the search button in the header): search an English word to see which Hebrew and Greek words it translates, or a Hebrew or Greek word (by transliteration, such as "chesed", or Strong's number, such as G26) to see:
  - where in the Bible it's used, per book (as a count, or per 1,000 words so long and short books compare fairly) and as a map of every chapter;
  - how the Berean Standard Bible translates it;
  - which words it's found together with in the same verses more often than chance;
  - every verse it's in, with the word marked and a link to read it in context.
- Built on the Berean Standard Bible interlinear (public domain) and the STEPBible brief lexicons (CC BY 4.0). The index is generated by `scripts/build-word-study.mjs` and served as static files.
- Previous/Next chapter buttons are now also at the top of the chapter, not only at the bottom.

## 1.5.0

- YouVersion now takes precedence: the about 530 translations both sources carry (such as BSB, ASV and Svenska Kärnbibeln) are read from YouVersion and get YouVersion ids in the URL, e.g. `#/yv-3034/JHN/3` for the BSB. Translations only the Free Use Bible API has keep their ids.
- Those translations keep the Free Use Bible API's recorded narration (when its verses line up with YouVersion's), and fall back to its text if YouVersion can't be reached.
- Older links and saved reading positions with the previous ids (e.g. `#/BSB/JHN/3`) switch to the new ones automatically.
- Prepares Bible Brain (Faith Comes By Hearing) as a third source, through a new `/api/bb` function that holds the key (`BIBLE_BRAIN_KEY`). Once a valid key is set, its recorded narration is offered for the translations it matches (such as KJV and Svenska Folkbibeln), and Bibles it carries with both text and narration are added (such as the Herziene Statenvertaling). Without a valid key nothing changes.

## 1.4.0

- Related verses work both ways, whatever the translation: verses with strong cross references get a small ⇄ marker at the end. Hovering (or tapping) it shows up to five related verses in the current translation, each with a link to read it in context. For example, Matthew 12:7 shows Hosea 6:6, and Hosea 6:6 shows Matthew 9:13 and 12:7.
- The cross references come from OpenBible.info (CC BY 4.0), credited at the bottom of the chapter. Only the most-voted links get a marker, so chapters don't fill up with them.
- Markers can be turned off in the reading settings ("Related-verse markers").

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
