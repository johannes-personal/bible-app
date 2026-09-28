import type { Book } from './api'

const OLD_TESTAMENT = new Set(
  (
    'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ' +
    'ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL'
  ).split(' '),
)

const NEW_TESTAMENT = new Set(
  (
    'MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS ' +
    '1PE 2PE 1JN 2JN 3JN JUD REV'
  ).split(' '),
)

export interface BookGroup {
  label: string
  books: Book[]
}

export function groupBooks(books: Book[]): BookGroup[] {
  const sorted = [...books].sort((a, b) => a.order - b.order)
  const groups: BookGroup[] = [
    { label: 'Old Testament', books: sorted.filter((b) => OLD_TESTAMENT.has(b.id)) },
    { label: 'New Testament', books: sorted.filter((b) => NEW_TESTAMENT.has(b.id)) },
    {
      label: 'Other books',
      books: sorted.filter((b) => !OLD_TESTAMENT.has(b.id) && !NEW_TESTAMENT.has(b.id)),
    },
  ]
  return groups.filter((g) => g.books.length > 0)
}

export function chapterNumbers(book: Book): number[] {
  const first = book.firstChapterNumber ?? 1
  return Array.from({ length: book.numberOfChapters }, (_, i) => first + i)
}
