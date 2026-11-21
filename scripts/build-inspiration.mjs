// Builds src/inspiration/verses.json: the verses inspiration mode shows, in three tiers, each
// tagged with its topics and the kind of background that suits it.
//
//   node scripts/build-inspiration.mjs [--review FILE]
//
// Where the choice comes from:
// - OpenBible.info's topical Bible (https://www.openbible.info/topics/, CC BY 4.0): people's
//   votes for the verses that fit a topic ("hope", "anxiety", "gods love"…). Each of the app's
//   topics gathers a handful of theirs; a passage's votes there say both how well-loved it is
//   and what it's about.
// - The Berean Standard Bible's text (public/word-study/text.txt) to check that a passage
//   reads on its own: it starts and ends a sentence, isn't long, and isn't about judgement.
//   Passages that stop mid-sentence are extended to the end of it (up to two verses).
// - A hand review: tiers 1 and 2 were read through, and what doesn't work as a card on its own
//   is in EXCLUDED below; a few classics are PROMOTED to tier 1. A card should make the reader
//   want to read its chapter, and the chapter should bear out what the card seemed to say: so
//   out go verses whose usual reading differs from what they mean where they stand (Jeremiah
//   29:11, Matthew 18:20), promises tied to one person or moment (Abram, Cyrus, Israel's
//   harvests), the advice of Job's friends, and verses whose "he" or "her" is in another verse.
//   A few are shown with the verse that gives their sense (CONTEXT).
//
// Topics take turns choosing their next best passage, so every topic is well represented at
// the top. The first TIER_1 chosen are tier 1, the next TIER_2 tier 2. Tier 3 is what's left
// that passes stricter checks (see `warm`), as it wasn't read through as closely.
//
// After changing the review, rebuild with --review FILE to get the chosen passages with their
// text, and read what moved into tiers 1 and 2.
//
// The vote counts (about 14 MB) are cached in .cache/inspiration. The output is committed;
// rerun this only to pick up new votes or a changed review.

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const CACHE = path.join(ROOT, '.cache/inspiration/topic-votes.txt')
const OUT = path.join(ROOT, 'src/inspiration/verses.json')
const reviewAt = process.argv.indexOf('--review')
const REVIEW = reviewAt > 0 ? process.argv[reviewAt + 1] : null

const TIER_1 = 400
const TIER_2 = 700
/** Tier 3 stops here, or when no topic has a warm passage left. */
const TOTAL = 2400
/** Votes a passage needs in a topic to count for it. */
const MIN_VOTES = 3
/** The most words (BSB) a passage may have, and the most verses. */
const MAX_WORDS = 64
const MAX_VERSES = 4

// The app's topics, in the order they're shown, and the OpenBible topics each gathers.
const TOPICS = {
  hope: ['hope', 'promises of god', 'gods promises', 'gods plan', 'new beginnings', 'waiting', 'gods timing', 'eternal life', 'heaven'],
  peace: ['peace', 'peace of mind', 'anxiety', 'anxious', 'fear and anxiety', 'worry', 'worrying', 'worry and anxiety', 'worry and stress', 'fear', 'fear not', 'rest', 'stress', 'cast your cares'],
  strength: ['strength', 'gods strength', 'courage', 'perseverance', 'hard times', 'difficult times', 'trials and tribulations', 'being strong', 'weakness', 'challenges', 'overcoming', 'endurance'],
  love: ['gods love', 'gods love for us', 'god loves me', 'love', 'unconditional love', 'real love', 'love one another', 'loving others', 'loving each other', 'love is'],
  comfort: ['comfort', 'loneliness', 'being lonely', 'healing a broken heart', 'inner healing', 'losing a loved one', 'grief', 'depression', 'hurt feelings', 'gods presence'],
  joy: ['joy', 'happiness', 'rejoicing', 'praise', 'praise and worship'],
  faith: ['faith', 'faith in god', 'trust', 'trusting god', 'trust in god', 'trusting in god', 'god is in control', 'gods faithfulness'],
  guidance: ['guidance', 'direction', 'wisdom', 'gods will', 'purpose in life', 'purpose', 'decision making', 'plans'],
  grace: ['gods grace', 'grace', 'mercy', 'gods mercy', 'forgiveness', 'forgiveness of sins', 'salvation', 'new life', 'asking for forgiveness'],
  gratitude: ['thanksgiving', 'thankfulness', 'being thankful', 'gratitude', 'blessings', 'thankful'],
}
// Count towards a passage's standing (and take turns choosing) without being a topic of their own.
const GENERAL = ['encouragement', 'positive thinking', 'inspiration', 'inspirational', 'motivation', 'self worth', 'victory', 'encouraging each other']

// Words that mark a passage as not for an uplifting card (judgement, violence and the like).
const UNFIT = /\b(kill|killed|slay|slain|slaughter\w*|wrath|curse[sd]?|cursing|harlot|prostitut\w*|adulter\w*|whor\w*|sodom\w*|vengeance|avenge|torment\w*|hell|hades|plague|abomination|eunuch\w*|circumcis\w*|uncircumcis\w*|corpse\w*|bloodshed|devour\w*|burnt|dung|divorce\w*|drunk\w*|sexual\w*|immoral\w*|lust\w*|idol\w*|demon\w*)\b/i

// Passages that mention people or places by name are mostly narrative, or need their story to
// make sense; these, and the wise sayings that turn on fools and the wicked, go after the rest
// of their topic (in practice, to tier 3 or out). Names of God and words that start a quotation
// don't count.
const NOT_NAMES = new Set(
  `God His He You Your Him Jesus Christ Lord My Me Spirit Father Son Holy God’s Himself One Hosts
  Savior Man Most High Law King Maker Rock Almighty Redeemer Scriptures Scripture Myself Father’s
  Lamb Mine Lord’s Word Advocate Us Our Light Christ’s Yourself Creator Name Child Presence Prince
  Alpha Omega Selah Amen Servant Judge Righteous Shepherd Majesty Yours Wonderful Counselor Mighty
  Everlasting Peace Deity Strength Beloved Protector Faithful True Witness Originator Way Beginning
  Jesus’ Hallelujah Israel Zion Jacob Jerusalem Paradise Sheol Pit Death Day Teacher Prophets
  And For Then So To As This But Come No The We Show Behold There When Three Immediately I`.split(/\s+/),
)
const SECOND_RANK = /\b(sabbath|seventh day|fools?|folly|wicked|woe|replied|answered|asked|inquired|explained|breasts?|kiss\w*|wives|husbands?)\b/i
function secondRank(text) {
  if (SECOND_RANK.test(text)) return true
  for (const m of text.matchAll(/\b[A-Z][a-z’]+/g)) {
    const before = text.slice(0, m.index).trimEnd()
    if (!before || /[.!?“‘"—:]$/.test(before)) continue
    if (!NOT_NAMES.has(m[0])) return true
  }
  return false
}

// Let in by hand: well-loved passages the checks above would turn away (they start mid-sentence,
// or mention something UNFIT on the way to their point).
const INCLUDED = new Set(['PHP.1.6', 'JHN.10.10', 'ECC.3.1'])

// Shown with a neighbouring verse that keeps them true to their chapter: "I can do all things"
// is about being content with much or little; "no eye has seen" goes on to say God has shown it.
const CONTEXT = new Map([
  ['PHP.4.13', [12, 13]],
  ['1CO.2.9', [9, 10]],
])

// Put in tier 1 by hand: verses everyone knows that the turns below leave lower.
const PROMOTED = ['PSA.23.1', 'ROM.8.1', 'PSA.51.10', 'ISA.40.8', 'JOS.24.15', 'MAT.5.14']

// Taken out by hand: passages the votes rank highly that don't work on their own as a card
// (they need their context, read as a command to someone else, or are hard words).
const EXCLUDED = new Set([
  'MAT.6.14-15', 'REV.1.1-2', 'PRO.11.14', 'MAT.17.20', 'GEN.2.2-3', 'PSA.68.5-6', 'EPH.1.11-12', 'ACT.2.38',
  'LUK.17.3-4', '2PE.1.4', 'HEB.4.9-10', 'MAT.21.21', 'PRO.12.15', 'GEN.2.18', '1PE.2.15', 'JHN.4.23',
  'LUK.23.34', '1TI.5.8', 'JAS.5.14-15', 'ACT.3.19-20', 'PSA.50.14', 'JHN.5.30', 'ACT.17.10-11', 'ISA.14.24',
  'HAB.3.19', 'COL.4.2-3', 'ISA.55.7', 'EPH.5.25-27', 'MRK.10.52', 'EPH.5.15-16', 'PSA.22.28', 'ISA.43.4',
  'ACT.20.35', 'JAS.1.6', '1CO.1.3-4', 'EPH.5.17', 'DAN.9.9-10', '1TI.4.4-5', 'MRK.6.31', 'PRO.10.28',
  'PRO.21.1', 'PRO.14.23', 'ROM.8.6-7', 'ISA.45.7', 'HEB.10.17', '2CO.4.15', 'ROM.1.11-12', 'GEN.2.24',
  'JER.6.16', 'PRO.16.4', 'ACT.13.38-39', 'ECC.12.13-14', 'JHN.4.24', '1TI.1.7', 'JON.2.9', '1CO.4.17',
  'HEB.12.14', '2TI.4.16', 'JAS.2.17', 'HEB.10.2', 'PSA.62.8-9', 'ECC.9.7-8', 'ROM.1.21', 'DEU.20.4',
  'JAS.4.8', '1TI.2.1-2', 'MRK.2.27', 'ACT.10.38', 'MAT.5.23-24', '1JN.4.1', 'JOS.23.14', '1JN.4.20',
  'JHN.7.17', 'LUK.12.2', 'LUK.17.5', 'HEB.11.11', 'ROM.16.20', 'MAT.15.28', 'ACT.17.30', '1CO.15.2',
  'HEB.12.15', '2CH.30.9', '1CO.1.5-6', 'HEB.4.11', 'ACT.22.16', 'ROM.15.3', 'MRK.16.16', 'PSA.90.3',
  'EXO.23.12', 'HAB.2.4-5', '1CH.10.13-14', 'JER.3.12', '2TH.1.3', '1JN.3.17', '1PE.4.7', 'PRO.16.33',
  '1TH.1.2-3', 'JHN.16.32', 'JER.30.19', 'EZR.10.4', 'PRO.14.2', '1CO.14.33', 'LUK.7.47', 'PSA.116.17',
  'EXO.20.8-10', 'MAT.14.29-31', '1TI.1.12', 'MAT.15.11', 'ISA.30.15', 'PSA.41.4', 'HEB.10.26-27', 'PSA.50.23',
  '2CO.8.12', 'EZR.3.11', 'HEB.3.13', 'JHN.6.11', 'HEB.10.38', '1CO.9.10', 'DAN.2.23', 'MAT.6.24',
  'EXO.34.21', 'LUK.5.16', 'MAT.9.22', 'MRK.3.35', 'ROM.1.8', 'JAS.2.24', 'ROM.11.6', '1PE.3.7',
  '2CO.7.1', 'ACT.16.25', 'LUK.13.3', '2CO.10.5', 'MAT.27.46', 'PSA.27.6', 'JHN.8.7', 'ACT.15.32',
  '2CO.7.6-7', 'ROM.14.1', 'DAN.6.10', 'PSA.108.13', 'PRO.10.23', 'ROM.13.1', 'MRK.1.4', 'REV.3.5',
  'REV.3.21', 'JAS.4.15', 'ROM.12.20', 'PHM.1.4-5', '2TI.2.23-24', 'JHN.3.2', 'MAT.8.24', 'MAT.14.13',
  'COL.4.8', 'HEB.13.17', 'MAT.10.34-36', 'PRO.14.12', '1CO.15.33', 'ECC.8.6', 'ISA.57.1-2', 'AMO.3.6',
  'ACT.24.3', 'EPH.5.33', '2JN.1.12', 'DAN.4.35', 'MAT.6.2', '2CO.6.14', 'ECC.2.26', 'JHN.8.44',
  'COL.3.9-10', 'PRO.12.20', 'PRO.14.3', 'MAT.12.36-37', 'MAT.9.35', 'HEB.11.7', 'LUK.3.3-4', 'ECC.5.12',
  'LUK.10.9', '2CO.7.4', 'ROM.6.1-2', 'ISA.9.3', 'PRO.18.7', 'GAL.6.1', 'PSA.79.9', 'EPH.5.4',
  'COL.3.18-19', 'TIT.1.1-2', 'ECC.7.9', 'EPH.4.26-27', 'MAT.7.21', 'REV.2.10', '1PE.5.5', 'GEN.18.14',
  'DEU.3.22', 'GEN.3.8', 'ROM.14.11', '1CO.16.2', '1TI.6.10', 'JER.33.12', 'JOS.1.6', 'LUK.8.50',
  'ZEC.10.6', 'ISA.14.27', 'DEU.28.1', 'LUK.10.19', 'ROM.14.23', 'PRO.24.6', 'MRK.6.32', 'HEB.9.22',
  'NEH.12.46', 'ROM.13.4', '1TH.4.9', 'LAM.3.37', 'PRO.13.20', 'LEV.23.3', 'PSA.66.7-8', 'LEV.19.31',
  'JHN.11.41', 'PRO.24.10', 'PRO.6.16-19', 'PRO.20.3', 'ISA.57.14', 'LUK.21.15', 'MAT.18.15', '1CH.23.30',
  '1JN.2.16', '1PE.3.21-22', 'EXO.23.22', '1TI.3.2-3', '2CO.6.3', '1TI.5.5', 'ROM.5.15', '2SA.2.6',
  'REV.12.10', 'GAL.6.7', 'ACT.1.7', 'LUK.1.35', 'PRO.3.34', 'PRO.15.13-14', 'SNG.4.7', 'PSA.94.12-14',
  '2CO.4.13-14', 'PRO.20.18', 'LEV.25.4', 'DEU.31.3', 'PHM.1.7', '2TH.3.10', 'JHN.3.5', 'HEB.6.12',
  'EXO.20.11', 'ISA.41.2', 'RUT.1.8', 'EPH.4.28', 'ROM.16.17', 'DAN.6.22', 'HAB.2.19', 'PRO.15.2',
  'PRO.22.7', 'ACT.9.31', '2SA.10.12', 'DAN.4.37', 'MAT.12.33', 'HEB.3.6', 'REV.14.13', '1CO.9.12',
  'JHN.8.24', 'MAT.18.35', 'REV.5.13', 'ISA.38.19-20', '1TH.2.20', 'DEU.15.11', 'ISA.48.22', 'ROM.1.7',
  'GAL.6.8', 'GAL.2.21', '2PE.1.21', 'GEN.1.28', '1SA.17.45', 'JHN.19.11', 'JHN.9.31', 'ACT.8.22',
  'SNG.1.7', '2TI.4.17', 'COL.2.5', 'JHN.14.5', '1CO.10.16', 'MRK.1.35', 'EST.8.17', 'ISA.43.9',
  '1CO.12.28', 'MAT.11.25', '1TI.6.17', 'JHN.13.3', 'JHN.17.13', 'PRO.10.11', 'MAT.19.4-5', 'MRK.4.39',
  '1KI.20.5', 'PRO.28.20', '1JN.1.8', 'DEU.30.16', '1TH.2.11-12', '1CO.7.32', 'ACT.19.11-12', 'ROM.3.3',
  'ECC.7.20', 'PHP.4.3', 'REV.2.2', 'ISA.7.9', 'ISA.49.25', 'MRK.9.50', 'MAT.10.1', '2CO.8.1-2',
  'PHM.1.25', 'JOS.10.25', 'JAS.4.17', 'EXO.31.15', '1SA.30.6', 'MAT.18.2', 'LUK.6.45', 'HEB.4.1',
  'DEU.32.39', '1KI.8.66', '2CO.2.5-8', 'PHP.4.23', '2TI.4.1-2', 'ACT.2.1-2', 'PSA.4.4-5', 'PSA.142.4',
  'GEN.3.15', 'EXO.35.2', 'LUK.10.26', 'MAT.14.23-24', 'GAL.3.22', 'JAS.2.14', 'ZEC.4.2', 'PRO.1.20-22',
  '1TH.3.9', 'EPH.6.6', 'HEB.4.4', 'PRO.14.13', 'ECC.8.1', 'ACT.4.33', 'GAL.5.12', 'ISA.2.4',
  'MAL.3.6', 'MAT.14.19', 'MRK.10.9', 'ISA.48.18', '1CO.3.18', 'ROM.9.15', '2CO.1.1-2', '1CO.15.19',
  '1CO.7.15', 'PRO.13.24', 'NEH.12.43', 'ROM.7.6', 'DEU.28.8', 'JHN.5.28-29', 'EXO.16.23', 'ACT.13.2',
  'LUK.22.19', 'TIT.1.9', 'HEB.4.2', 'MAT.4.23', 'GEN.6.8', 'LUK.17.16', 'JAS.4.9-10', 'JER.32.2',
  'REV.11.15', 'ACT.1.10-11', 'NUM.13.20', 'JHN.13.1', 'PRO.11.3', '1TH.5.2', 'REV.3.11', '2JN.1.5',
  'PHP.4.2', 'JON.1.4', 'PRO.29.11', 'GAL.1.10', 'HEB.9.15', 'MAT.13.22', 'REV.3.10', 'LUK.9.11',
  'COL.2.8', 'EPH.1.2', 'REV.14.15', '1CO.4.5', 'REV.12.9', 'ECC.4.2', 'JAS.1.13', 'PRO.14.8',
  'MAT.10.26', '2TH.1.4', 'MAT.10.22', 'COL.2.15', 'MRK.13.11', 'PSA.44.2', '2TI.1.3', 'PSA.18.39',
  'LUK.6.19', '2CO.8.7', 'JAS.5.6', 'HEB.6.7', 'EXO.9.16', 'DEU.28.2-3', 'ISA.41.1', 'PRO.10.8',
  'HEB.13.9', 'JER.5.24', '2PE.1.20', 'MAT.19.21', 'MAT.26.45', 'HEB.11.2', 'JHN.6.44', 'ISA.41.14',
  'JOS.2.11', 'HEB.11.13', 'PRO.8.13', 'ECC.8.9', 'JHN.20.23', '1CO.14.3', 'JHN.11.12', 'PRO.20.6',
  'LUK.24.46-47', 'MAT.26.26-27', 'JHN.7.6', '1JN.2.19', 'ROM.5.17', '1CO.2.16', 'EPH.5.23', 'JER.23.24',
  '2TH.2.15', 'ROM.9.21', 'GAL.5.4', 'JAS.4.1', '1PE.3.1-2', 'JHN.6.28-29', 'JAS.2.18', 'ROM.6.15',
  'GEN.28.20-21', '1CH.19.13', 'ACT.15.8-9', 'JHN.4.34', 'MAT.3.8', 'LEV.26.3-4', 'EPH.6.22', 'MRK.16.19',
  '2CO.4.1-2', 'ACT.13.15', 'MRK.1.15', 'PHP.4.1', 'ROM.8.29', 'PRO.30.18-19', 'PRO.29.15', 'MRK.3.29',
  '1TI.3.16', 'MAT.10.19', '2TI.3.12-13', 'TIT.2.4-5', 'HEB.9.24', 'REV.12.11', 'ACT.20.28', 'JHN.3.18',
  'LEV.22.29', 'PSA.8.2', 'JHN.3.13', 'JAS.3.2', 'SNG.4.10', 'HAB.2.2', 'HEB.2.9', 'PRO.18.20',
  '2CO.4.4', 'MRK.9.3', 'MAT.24.45-47', 'DEU.28.47-48', '2PE.1.12', '1PE.2.11', 'ECC.1.18', 'REV.2.19',
  'ACT.2.46-47', 'PSA.89.33', 'HEB.13.18', 'PRO.13.3', 'PSA.55.18', 'JHN.14.4', 'MAT.6.7', 'REV.19.11',
  'COL.4.12', '2CO.3.6', '2TH.2.13', 'ACT.15.31', 'MAT.25.46', 'JHN.13.4', 'JHN.15.18-19', 'ISA.29.13',
  '1SA.26.23', 'JHN.16.7', 'ROM.14.6', 'PRO.13.2', 'LUK.24.52-53', '1CO.10.30', '1CO.9.8', '2SA.22.40',
  'LUK.2.40', '1CO.14.31', 'JOL.3.16', 'LUK.2.3', '1TI.4.16', 'SNG.2.16', 'PRO.13.1', '2CO.6.1',
  'ACT.27.36', 'ACT.1.9', 'REV.2.7', 'SNG.1.2', 'EXO.25.8', 'MAT.8.26', 'MAT.4.17', 'PRO.11.27',
  'GEN.3.16', '1KI.5.4', 'MRK.13.13', 'PRO.5.19', '1CO.15.42-44', 'ISA.28.29', 'GEN.2.9', 'GEN.1.20',
  'EPH.4.16', 'REV.14.12', 'JHN.1.8', 'HEB.3.14', 'LEV.24.17-18', '2CO.10.12', 'MAT.6.1', 'ROM.8.5',
  '2CO.7.10', 'EZK.2.6', 'EPH.2.1-2', '1JN.3.8', 'MAL.2.5', 'MAT.8.13', 'JER.17.9', 'PHP.1.12-14',
  'ACT.3.16', '2SA.22.26-27', 'DEU.4.40', '1TH.4.1', 'ECC.5.10', 'HEB.2.14-15', 'REV.3.19', 'PRO.16.1',
  '1TI.1.16', 'EXO.19.5', 'PRO.10.19', 'ECC.5.15', 'HEB.4.3', 'ISA.2.3', 'JAS.5.1', 'ECC.6.9',
  '2PE.3.3-4', 'SNG.4.9', 'JAS.2.26', 'PRO.14.1', '1SA.12.16', 'PSA.27.12', 'GEN.1.2', 'PSA.25.3',
  '1JN.4.2-3', '2TH.1.9-10', 'ROM.10.4', 'PRO.10.4', 'MAT.24.36', 'MAT.5.43', '1PE.4.2', 'MAT.6.5',
  'ECC.4.4', 'HEB.6.11', 'JHN.15.2', '2PE.1.10-11', 'ROM.13.2', 'DEU.7.21', 'MAT.10.37-38', '2CO.1.24',
  'ISA.49.7', 'PSA.60.12', 'PHM.1.3', '2TI.1.10-11', 'MAL.3.17', 'PRO.18.1', '2CO.1.12', 'ISA.59.2',
  'JAS.1.9', 'JER.15.17', 'HEB.10.5', 'PRO.27.12', 'HEB.8.6', 'PRO.16.6', '1PE.5.2-3', '2JN.1.3',
  'PSA.78.24', 'HEB.13.7', 'ISA.40.2', '1CO.3.19', '1JN.5.18', 'PRO.3.15', '1CO.2.14', 'GEN.9.11',
  '1TH.2.19', 'ROM.14.4', 'PRO.15.12', 'HEB.8.3', 'MAT.18.10', '1TH.5.1', 'JOB.30.27', 'JHN.17.26',
  'JER.5.22', 'PRO.16.2', 'PRO.16.23', '2TI.4.22', '1TH.2.13', 'MAT.19.28', 'ROM.13.7', '1JN.3.10',
  'EZK.1.28', '1KI.1.40', 'PSA.144.1', 'JER.6.14', '1TH.5.12', 'LUK.1.45', 'EPH.4.18', 'PSA.101.6',
  'LUK.21.36', 'JHN.6.54', 'HEB.2.10', 'JER.8.11', 'LUK.10.20', 'PSA.5.9', 'PRO.19.2', '1SA.22.23',
  '1TI.2.9-10', '2SA.7.29', 'ACT.27.25', '1SA.2.35', 'ROM.9.18', 'PSA.26.6-7', 'HEB.10.32', '1TI.3.9',
  'JOL.3.14', 'ACT.3.8', 'PRO.11.13', 'PSA.37.9', 'ISA.14.7', '1TH.3.5', 'MAT.12.32', '1CH.16.12-13',
  'GEN.9.5-6', 'JAS.3.3', 'MAT.13.15', 'LUK.18.8', 'DEU.1.32-33', 'LUK.24.36', 'ACT.27.22', 'ZEP.3.2',
  'MAT.12.13', 'ACT.8.8', '2CO.5.10', 'MAT.24.12', 'DEU.24.5', 'JAS.2.1', 'ROM.11.5', '2TI.2.2',
  '1TI.6.2', '1TH.5.3', 'REV.2.17', 'EPH.6.23', 'JDG.5.3', 'HOS.14.3', 'ISA.66.1', '1PE.2.20',
  'JHN.21.20', '1CO.14.15', 'EXO.31.3-5', 'DEU.5.29', 'JOB.7.6', 'HEB.9.11', 'ROM.15.30', '2TI.1.13',
  'GAL.6.16', 'LUK.16.11', 'HEB.11.39-40', 'MAT.16.8', 'JOB.12.16', 'JHN.19.26', 'PSA.61.7', '1CO.2.7',
  'PSA.89.28', '2CO.1.7', '1CO.1.20', 'DAN.2.44', 'SNG.8.2', 'LUK.9.6', 'EPH.1.9-10', 'JOB.27.8',
  'HAB.1.11', 'JHN.17.2', 'COL.1.28', 'LAM.3.2', 'LUK.11.24', '1PE.5.9', 'JOS.23.11', '2CO.12.12',
  'HEB.2.12', 'ISA.2.22', 'JUD.1.22-23', 'ROM.14.2', 'JUD.1.3', 'ISA.28.2', 'GAL.4.2', 'GAL.3.11',
  'MAT.6.23', '1CO.3.10', 'LAM.3.29', 'ROM.15.14', 'MIC.7.5', 'ACT.11.24', 'JAS.2.20', 'ROM.11.22',
  'PHM.1.6', 'PRO.14.6', 'PSA.18.25-26', '2TI.2.10', 'SNG.2.4', 'JHN.5.13', 'EXO.35.31-33', 'DAN.4.2',
  'DEU.14.23', 'ISA.62.5', 'PSA.22.2', 'ROM.13.11', 'JOB.8.13', 'REV.3.12', 'REV.2.4', 'ROM.9.16',
  'LUK.22.20', 'REV.21.19-20', 'EPH.3.2-3', 'JOB.7.16', 'DEU.16.15', 'JAS.2.22', 'PRO.10.13', 'PSA.123.2',
  'JOB.5.23', '1CO.2.13', '1CO.6.3', 'DAN.7.14', '1TH.5.13', 'ISA.41.15', 'LUK.1.14-15', 'GEN.24.49',
  '1CO.2.6', 'GAL.1.6-7', 'GEN.1.12', 'JHN.11.3', 'MAT.8.10', 'PSA.21.5', '2CO.13.5', 'EXO.21.5-6',
  '1CO.14.16', '1JN.2.8', 'ACT.2.3', '2CO.10.15-16', 'DAN.10.18', '2TH.1.11-12', 'EPH.6.21', '1CO.1.19',
  'HOS.4.1', 'TIT.1.3', 'SNG.7.6', 'GEN.31.29', 'ACT.16.33-34', 'MRK.5.19', 'HEB.10.1', 'PSA.77.8',
  'DEU.33.25', 'MRK.5.28', 'DAN.5.14', '1CO.1.17', '2KI.18.20', 'PRO.21.30', 'JOB.6.8-9', 'PSA.68.28',
  '1JN.2.7', 'DEU.14.26', '2CO.1.18', 'PRO.5.6', 'PSA.45.2', 'ACT.7.49', 'PRO.20.28', 'JOB.8.19',
  '1CH.22.18', 'MAT.18.33', 'JHN.12.40', 'ISA.10.13', 'PSA.119.82', 'ISA.50.10', 'PSA.109.4', '1KI.8.30',
  'DEU.7.12', 'PSA.70.2', 'JOB.3.7', 'REV.17.14', '1CO.1.21', '2CO.8.21', 'JOB.5.8-9', 'JER.39.18',
  'ISA.53.10', 'JOB.25.2-4', 'PSA.89.24', 'MRK.8.25-26', 'GEN.1.11', 'LUK.16.12', 'ECC.10.10', 'PSA.112.2',
  'ACT.3.21', 'GAL.3.21', 'COL.2.23', '1JN.1.2', 'ACT.28.20', 'PSA.12.1', 'DEU.4.6', 'ECC.9.9',
  'ROM.3.12', 'ISA.49.4', 'JDG.5.8', 'PRO.12.8', 'JOB.41.9', 'ISA.47.10', 'PSA.41.9', 'JOB.4.6',
  '1KI.3.28', '1CH.29.15', 'REV.19.9', 'ISA.29.14', 'DEU.26.15', '2CH.1.10', 'DAN.12.12', 'ECC.12.11',
  'REV.21.10-11', 'ECC.11.8', 'AMO.9.14-15', 'ISA.16.10', 'PSA.24.5', 'ACT.2.32', '2CH.9.7', 'LUK.21.27-28',
  'PSA.21.1', 'REV.11.16-17', 'PHP.1.25-26', 'PSA.119.164', 'LUK.22.43', 'DEU.7.19', 'MAT.7.13-14', 'EPH.5.11',
  '1CO.9.2', 'PSA.73.2', '1CO.5.2', 'ROM.6.3', 'HEB.13.22', 'PRO.13.22', 'PRO.25.19', 'MAT.9.2',
  'ACT.4.22', 'PSA.75.2', 'MAT.18.18', 'PSA.45.7', 'LUK.14.28', 'MAT.4.3', 'NUM.14.9', 'PRO.21.20',
  'PHP.1.29-30', 'ZEC.10.1', '2CO.1.6', 'DEU.1.21', 'MRK.4.17', 'JHN.8.42', 'MAT.14.15', 'LAM.3.17',
  '1PE.4.1', 'JHN.19.30', 'JHN.20.17', 'HEB.9.27-28', 'JHN.5.39-40', 'SNG.3.4', 'ACT.5.31', 'JAS.3.5',
  'ACT.18.10', 'ECC.9.11', 'JER.31.2', 'ACT.17.26', 'TIT.2.2', 'PRO.19.14', 'PSA.94.2', 'JHN.13.23',
  '2SA.12.23', 'ACT.11.23', 'MAT.13.2', 'JHN.17.20-21', 'JHN.16.3', 'PSA.37.2', 'MAT.12.31', 'GAL.6.4',
  'REV.1.7', 'PRO.12.2', '1JN.2.27', '1CO.16.3', 'REV.19.20', 'GEN.2.1', 'PSA.110.1', '2TH.2.6',
  'HOS.14.2', 'PRO.13.4', 'EPH.3.13', 'ROM.5.12', '1JN.3.15', 'PRO.22.3', 'MAT.24.21', 'JHN.3.6',
  'PSA.97.5', 'JER.23.23', 'ISA.33.15-16', 'JAS.5.12', 'ECC.11.2', 'COL.1.24', 'JER.8.21', 'PRO.28.9',
  'MAL.3.16', 'GEN.35.17', 'LUK.22.28', 'MAT.22.1-2', 'EXO.3.2', 'ROM.10.2', 'GEN.1.14', 'ZEP.3.3',
  'ACT.2.41', 'JER.29.11', 'JER.29.14', 'DEU.31.6', 'HAB.2.3', 'ISA.43.18-19', 'MAL.3.10', 'JER.1.5',
  'JER.1.7-8', 'GEN.12.2', 'GEN.28.15', 'ISA.45.3', 'DAN.10.19', 'EXO.23.25', 'DEU.7.13', 'DEU.8.18',
  'DEU.8.10', 'LEV.26.6', 'JOL.2.26', 'JOL.2.21', 'JOL.2.23', '2CH.15.7', '2CH.16.9', 'NUM.14.18',
  'EXO.13.21-22', '2SA.7.28', 'HOS.6.3', 'ISA.30.26', 'ISA.30.29', 'ISA.41.6', 'HAG.2.9', 'JOB.5.17',
  'JOB.5.18', 'JOB.5.19', 'JOB.5.16', 'JOB.8.7', 'JOB.8.21', 'JOB.11.18', 'JOB.22.21', 'JOB.22.26',
  'JOB.32.8', 'JOB.33.26', 'JOB.33.28', 'JOB.37.23', 'JOB.12.12', 'JOB.7.7', 'JOB.16.5', 'MAT.18.20',
  'MAT.21.22', 'MRK.11.23', 'MRK.11.24', 'MRK.5.34', 'LUK.8.48', 'LUK.17.19', 'MAT.9.29', 'LUK.12.12',
  'LUK.7.35', 'MAT.19.2', 'MAT.2.10', '3JN.1.2', '1TH.4.18', 'ROM.4.20-21', 'HEB.11.16', 'HEB.10.34',
  'PHP.4.11', 'PSA.21.6', 'PSA.20.6', 'PSA.41.2', 'PSA.41.3', 'PSA.46.5', 'PSA.44.3', 'PSA.132.14',
  'PSA.132.16', 'PSA.147.13', 'PSA.35.27', 'PSA.102.7', 'PSA.42.3', 'PSA.42.4', 'PSA.13.1', 'PRO.3.16-18',
  'PRO.4.9', 'REV.14.14', 'REV.2.11', 'JOB.40.2', 'EXO.22.14', '1CO.14.26', '2CO.12.19', 'ZEC.9.15',
  '1CO.15.24', 'LUK.18.27', 'JHN.15.17', 'PSA.86.15', '2SA.22.33', 'LUK.12.22', 'LUK.12.24', 'LUK.6.23',
  'MAT.10.39', 'LUK.17.33', 'PSA.113.1', '1JN.1.4', 'PSA.33.1', 'EZK.11.19-20', 'PSA.107.21-22',
])

// --- Inputs ---

const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/word-study/meta.json'), 'utf8'))
const text = new Map()
for (const line of fs.readFileSync(path.join(ROOT, 'public/word-study/text.txt'), 'utf8').split('\n')) {
  const tab = line.indexOf('\t')
  if (tab > 0) text.set(Number(line.slice(0, tab)), line.slice(tab + 1))
}
const code = (book, chapter, verse) => book * 1_000_000 + chapter * 1000 + verse
const refOf = (p) => `${meta.books[p.book].id}.${p.chapter}.${p.first}${p.last !== p.first ? `-${p.last}` : ''}`

const topicOf = new Map()
const names = Object.keys(TOPICS)
names.forEach((name, i) => TOPICS[name].forEach((t) => topicOf.set(t, i)))
GENERAL.forEach((t) => topicOf.set(t, names.length))

if (!fs.existsSync(CACHE)) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true })
  const res = await fetch('https://a.openbible.info/data/topic-votes.txt')
  if (!res.ok) throw new Error(`OpenBible download failed: ${res.status}`)
  fs.writeFileSync(CACHE, await res.text())
}

// --- Passages and their votes per topic ---

/** "bbcccvvv" (book 01 = Genesis) to book index, chapter and verse. */
const parseId = (id) => ({ book: Number(id.slice(0, 2)) - 1, chapter: Number(id.slice(2, 5)), verse: Number(id.slice(5, 8)) })

const passages = new Map()
/** Votes in every topic, the app's or not: how well known a passage is. */
const known = new Map()
for (const line of fs.readFileSync(CACHE, 'utf8').split('\n')) {
  const [topic, start, end, votes] = line.split('\t')
  if (!/^\d{8}$/.test(start)) continue
  const a = parseId(start)
  const b = end ? parseId(end) : a
  if (b.book !== a.book || b.chapter !== a.chapter || b.verse < a.verse || b.verse - a.verse >= MAX_VERSES) continue
  const p = { book: a.book, chapter: a.chapter, first: a.verse, last: b.verse }
  const key = refOf(p)
  known.set(key, (known.get(key) ?? 0) + Number(votes))
  const t = topicOf.get(topic)
  if (t == null) continue
  const entry = passages.get(key) ?? passages.set(key, { ...p, votes: new Array(names.length + 1).fill(0) }).get(key)
  entry.votes[t] += Number(votes)
}
for (const [key, p] of passages) p.known = known.get(key)

// --- Reading on its own ---

const ENDS_SENTENCE = /[.!?][”’"')\]]*$/
/** Before a passage: the end of a sentence, or a colon introducing what it says. */
const ENDS_LEAD_IN = /[.!?:][”’"')\]]*$/
const verseText = (book, chapter, verse) => text.get(code(book, chapter, verse))
const passageText = (p) => {
  const parts = []
  for (let v = p.first; v <= p.last; v++) parts.push(verseText(p.book, p.chapter, v))
  return parts.every(Boolean) ? parts.join(' ') : null
}
const words = (s) => s.split(/\s+/).filter(Boolean).length

/** The passage made whole: extended to the end of its sentence, or null if it can't be. */
function whole(p) {
  const context = CONTEXT.get(refOf(p))
  if (context) p = { ...p, first: context[0], last: context[1] }
  const included = INCLUDED.has(refOf(p))
  // It must start a sentence: the verse before ends one.
  const before = verseText(p.book, p.chapter, p.first - 1)
  if (before && !ENDS_LEAD_IN.test(before.trim()) && !included) return null
  let last = p.last
  while (!included && !ENDS_SENTENCE.test((verseText(p.book, p.chapter, last) ?? '').trim())) {
    if (last - p.last >= 2 || !verseText(p.book, p.chapter, last + 1)) return null
    last++
  }
  const q = { ...p, last }
  const s = passageText(q)
  if (!s || words(s) > MAX_WORDS || q.last - q.first >= MAX_VERSES || (UNFIT.test(s) && !included)) return null
  return { ...q, text: s }
}

const candidates = new Map()
for (const p of passages.values()) {
  const q = whole(p)
  if (!q) continue
  const key = refOf(q)
  const seen = candidates.get(key)
  if (seen) {
    seen.votes = seen.votes.map((v, i) => v + p.votes[i])
    seen.known += p.known
  } else candidates.set(key, { ...q, key, votes: [...p.votes], known: p.known })
}
for (const c of candidates.values()) c.total = c.votes.reduce((a, b) => a + b, 0)

// Overlapping passages (Phil 4:6, 4:6-7, 4:6-8): keep the best loved; the others' votes count
// for it.
const byVerse = new Map()
const sorted = [...candidates.values()].sort((a, b) => b.total - a.total || a.last - a.first - (b.last - b.first))
const kept = []
for (const c of sorted) {
  let owner = null
  for (let v = c.first; v <= c.last && !owner; v++) owner = byVerse.get(code(c.book, c.chapter, v))
  if (owner) {
    owner.votes = owner.votes.map((v, i) => v + c.votes[i])
    owner.known += c.known
    continue
  }
  for (let v = c.first; v <= c.last; v++) byVerse.set(code(c.book, c.chapter, v), c)
  kept.push(c)
}

// --- Tiers: topics take turns choosing their next best passage ---
// Besides the topics, the general encouragement topics take a turn, and so does how well known
// a passage is (its votes in every topic, for passages with some in the app's).

const fit = kept.filter((c) => !EXCLUDED.has(c.key))
for (const c of fit) c.second = secondRank(c.text)
/** Best first, second-rank passages after all the others. */
const ranked = (list, score) => list.sort((a, b) => Number(a.second) - Number(b.second) || score(b) - score(a))
const lists = names.map((_, t) => ranked(fit.filter((c) => c.votes[t] >= MIN_VOTES), (c) => c.votes[t]))
lists.push(ranked(fit.filter((c) => c.votes[names.length] >= MIN_VOTES), (c) => c.votes[names.length]))
lists.push(ranked(fit.filter((c) => c.total >= MIN_VOTES * 3), (c) => c.known))
const chosen = PROMOTED.map((key) => {
  const c = fit.find((c) => c.key === key)
  if (!c) throw new Error(`Promoted passage not found: ${key}`)
  return c
})
const taken = new Set(PROMOTED)

// The same words more than once (the gospels' parallel sayings, a psalm's refrain, "Give thanks
// to the LORD, for He is good" in six places): only the first one chosen.
const wordSet = (text) => new Set(text.toLowerCase().match(/[a-z’']+/g) ?? [])
const chosenWords = chosen.map((c) => wordSet(c.text))
function repeats(c) {
  const mine = wordSet(c.text)
  return chosenWords.some((other) => {
    let shared = 0
    for (const w of mine) if (other.has(w)) shared++
    return shared / (mine.size + other.size - shared) >= 0.6
  })
}

/** Topics take turns adding their best passage not yet chosen, until `count` are chosen. */
function takeTurns(lists, count) {
  const next = lists.map(() => 0)
  while (chosen.length < count) {
    let added = false
    for (const [t, list] of lists.entries()) {
      while (next[t] < list.length && (taken.has(list[next[t]].key) || repeats(list[next[t]]))) next[t]++
      if (next[t] >= list.length || chosen.length >= count) continue
      const c = list[next[t]++]
      taken.add(c.key)
      chosen.push(c)
      chosenWords.push(wordSet(c.text))
      added = true
    }
    if (!added) break
  }
}
takeTurns(lists, TIER_1 + TIER_2)
// Tier 3 takes only warm passages: not of the second rank, with a fair number of votes, at least
// one warm word and no hard ones.
const WARM = /\b(love[sd]?|loving|hope|peace|joy\w*|rejoic\w*|glad\w*|strength\w*|strong|courage\w*|faith\w*|trust\w*|grace|gracious|merc\w+|compassion\w*|kind\w*|good\w*|bless\w*|prais\w*|thank\w*|light|life|rest|comfort\w*|help\w*|refuge|shelter|heal\w*|sav(e|es|ed|ior)|salvation|delight\w*|sing|song\w*|wonder\w*|beautiful|forgiv\w*|new|guides?|lead[s]?|wisdom|cares?|near|precious|shepherd|renew\w*|restor\w*|satisf\w*|abundan\w*|eternal|forever|everlasting)\b/gi
const HARD = /\b(hate[sd]?|hatred|enem(y|ies)|foes?|wither\w*|die[sd]?|dead|death|disaster|calamit\w*|terror|anger|angry|evil|sin|sins|sinned|sinners?|lie|liar|lazy|laziness|slacker|poverty|punish\w*|lawless\w*|rebuke\w*|depart|stubborn|blasphem\w*|unbeliev\w*|disobe\w*|shame\w*|weep\w*|tears|groan\w*|trouble[sd]?|distress\w*|oppress\w*|afflict\w*)\b/i
const warm = (c) => !c.second && c.total >= 15 && (c.text.match(WARM)?.length ?? 0) >= 1 && !HARD.test(c.text)
takeTurns(lists.map((list) => list.filter(warm)), TOTAL)

/** A passage's topics: those with a good share of its votes (and always its strongest). */
function topicsOf(c) {
  const own = c.votes.slice(0, names.length)
  const top = Math.max(...own)
  let mask = 0
  own.forEach((v, t) => {
    if (v >= MIN_VOTES && (v === top || v >= top * 0.2)) mask |= 1 << t
  })
  // Chosen for being well known or encouraging: its strongest topic, however few the votes.
  if (!mask && top > 0) mask = 1 << own.indexOf(top)
  return mask
}

// --- Backgrounds: the kind of scene that suits each passage (drawn by src/inspiration/art.ts) ---
// From its words when they paint a picture: each word a scene's list has counts (the plainer
// words in the second list count half), and the scene listed first wins a tie. Otherwise from
// its strongest topic, a different one of the topic's scenes for different passages.

const SCENES = [
  ['rainbow', /\b(rainbow|bow in the clouds?|promises)\b/gi, /\b(covenant|promised?|faithful)\b/gi],
  ['night', /\b(night|nights|midnight|evening|sleep|asleep|moon|stars?|darkness)\b/gi, /\b(dark|lie down|rest)\b/gi],
  ['rain', /\b(rain|rains|showers?|dew|storms?|tempest|thunder|clouds? burst)\b/gi, /\b(wind|tears|weep\w*|mourn\w*)\b/gi],
  ['lake', /\b(still|quiet|quietly|stillness|waters|springs?|streams?|rivers?|well-watered)\b/gi, /\b(drink|calm|peace|rest)\b/gi],
  ['sea', /\b(sea|seas|waves|floods?|ocean|depths|deep)\b/gi, /\b(overwhelm\w*|roar\w*)\b/gi],
  ['mountains', /\b(mountains?|rock|rocks|fortress|stronghold|heights|high places)\b/gi, /\b(refuge|shield|strong|strength|firm|unshaken|shaken|moved)\b/gi],
  ['hills', /\b(hills?|valley|valleys|land)\b/gi, null],
  ['path', /\b(paths?|road|journey|race)\b/gi, /\b(way|ways|steps|feet|foot|walk|walks|walking|guide\w*|lead|leads|led|straight|run|running)\b/gi],
  ['forest', /\b(trees?|forest|cedars?|olive|planted|rooted|roots?|branches?|vines?|woods|leaf|leaves)\b/gi, /\b(grow|grows|growing)\b/gi],
  ['meadow', /\b(fields?|grass|flowers?|lilies|harvest|seeds?|sow|sows|sown|reap|reaps|garden|pastures?|green|bloom|blossom\w*|grain|sparrows|shepherd|sheep|flock|lambs?)\b/gi, /\b(fruit\w*|bread|food)\b/gi],
  ['dunes', /\b(desert|wilderness|dry|parched|wasteland|sand|thirst\w*|weary)\b/gi, null],
  ['sky', /\b(heavens?|sky|skies|clouds?|eagles?|wings?|soar|birds?)\b/gi, /\b(glory|throne|above|high)\b/gi],
  ['sunrise', /\b(morning|dawn|sun|sunrise|shine|shines|shining|arise|risen)\b/gi, /\b(light|new|rise|rises|day|today|joy)\b/gi],
  ['glow', /\b(tender\w*|compassion\w*|embrace\w*)\b/gi, null],
]
const TOPIC_SCENES = {
  hope: ['sunrise', 'sky', 'path', 'meadow', 'hills'],
  peace: ['lake', 'meadow', 'night', 'sky', 'forest'],
  strength: ['mountains', 'sea', 'hills', 'forest', 'dunes'],
  love: ['glow', 'sunrise', 'meadow', 'lake', 'hills'],
  comfort: ['rain', 'lake', 'night', 'forest', 'glow'],
  joy: ['meadow', 'sunrise', 'glow', 'sky', 'hills'],
  faith: ['sky', 'mountains', 'path', 'sea', 'dunes'],
  guidance: ['path', 'hills', 'forest', 'sunrise', 'night'],
  grace: ['sunrise', 'glow', 'lake', 'sky', 'meadow'],
  gratitude: ['meadow', 'hills', 'sunrise', 'glow', 'sky'],
}
const ANY_SCENE = ['hills', 'glow', 'sky', 'sunrise', 'meadow', 'lake']

/** A small, stable number from a passage's key, to vary the default scenes. */
const keyNumber = (key) => [...key].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7)

function sceneOf(c) {
  let best = null
  let bestScore = 0
  for (const [scene, strong, plain] of SCENES) {
    const score = (c.text.match(strong) ?? []).length + (plain ? (c.text.match(plain) ?? []).length * 0.5 : 0)
    if (score > bestScore) {
      best = scene
      bestScore = score
    }
  }
  if (best && bestScore >= 1) return best
  const own = c.votes.slice(0, names.length)
  const top = Math.max(...own)
  const choices = top > 0 ? TOPIC_SCENES[names[own.indexOf(top)]] : ANY_SCENE
  return choices[keyNumber(c.key) % choices.length]
}

const verses = chosen.map((c, i) => {
  const tier = i < TIER_1 ? 1 : i < TIER_1 + TIER_2 ? 2 : 3
  return [meta.books[c.book].id, c.chapter, c.first, c.last, tier, topicsOf(c), sceneOf(c)]
})

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(
  OUT,
  `{"source":"Chosen from OpenBible.info's topical Bible votes (CC BY 4.0, www.openbible.info/topics) by scripts/build-inspiration.mjs.",\n` +
    `"topics":${JSON.stringify(names)},\n` +
    `"columns":["book","chapter","first verse","last verse","tier","topics (bits, in the order above)","scene"],\n` +
    `"verses":[\n${verses.map((v) => JSON.stringify(v)).join(',\n')}\n]}\n`,
)
const counts = [1, 2, 3].map((t) => verses.filter((v) => v[4] === t).length)
console.log(`${verses.length} passages (tiers: ${counts.join(' / ')}) → ${path.relative(ROOT, OUT)}`)
const sceneCounts = {}
for (const v of verses) sceneCounts[v[6]] = (sceneCounts[v[6]] ?? 0) + 1
console.log('  scenes:', Object.entries(sceneCounts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', '))
names.forEach((n, t) => {
  const inTopic = verses.filter((v) => v[5] & (1 << t))
  console.log(`  ${n}: ${inTopic.length} (tier 1: ${inTopic.filter((v) => v[4] === 1).length})`)
})

if (REVIEW) {
  const lines = chosen.map((c, i) => {
    const tier = i < TIER_1 ? 1 : i < TIER_1 + TIER_2 ? 2 : 3
    const tags = names.filter((_, t) => topicsOf(c) & (1 << t)).join(',')
    return `${i + 1}\tT${tier}\t${c.key}\t${tags}\t${c.text}\t${sceneOf(c)}`
  })
  fs.writeFileSync(REVIEW, lines.join('\n') + '\n')
}
