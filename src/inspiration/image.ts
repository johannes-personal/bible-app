import { drawScene, type Scene } from './art'

// The card as an image to save or share: 1080 × 1920 (9:16, the shape of a phone screen and of
// stories), the scene with the verse and its reference over it. The card on screen is laid
// out the same way, sized from the same measurements.

export const IMAGE_WIDTH = 1080
export const IMAGE_HEIGHT = 1920

export const VERSE_FAMILY = 'Playfair Display'
export const VERSE_FONT = `'${VERSE_FAMILY}', Georgia, 'Times New Roman', serif`
export const LABEL_FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
/** The Google Fonts family, loaded when inspiration mode opens. */
export const VERSE_GOOGLE_FAMILY = 'Playfair+Display:ital,wght@0,400..900;1,400..900'

/** Line height, as a multiple of the font size. */
export const LINE_HEIGHT = 1.34
/** The text's width and the most height it may take, at IMAGE_WIDTH. */
const TEXT_WIDTH = 840
const TEXT_HEIGHT = 820
/** Where the middle of the words goes, as a share of the height. */
export const WORDS_AT = 0.44
const LARGEST = 88
const SMALLEST = 40

export interface CardContent {
  text: string
  /** "John 3:16" */
  reference: string
  /** "NIV" */
  translation: string
}

let measurer: CanvasRenderingContext2D | null = null
const measure = () => (measurer ??= document.createElement('canvas').getContext('2d')!)

const fontAt = (size: number) => `400 ${size}px ${VERSE_FONT}`

/** Words into lines no wider than `width`, greedily. */
function wrap(ctx: CanvasRenderingContext2D, words: string[], width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > width) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

/** Like `wrap`, but with lines of even length: the narrowest width that needs no more lines. */
export function balancedLines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines = wrap(ctx, words, width)
  if (lines.length < 2) return lines
  let low = width * 0.5
  let high = width
  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2
    if (wrap(ctx, words, mid).length > lines.length) low = mid
    else high = mid
  }
  return wrap(ctx, words, high)
}

/** The font size (at IMAGE_WIDTH) the verse fits at, and its lines. */
export function fitVerse(text: string): { size: number; lines: string[] } {
  const ctx = measure()
  for (let size = LARGEST; size > SMALLEST; size -= 2) {
    ctx.font = fontAt(size)
    const lines = balancedLines(ctx, text, TEXT_WIDTH)
    // Short verses stay a little smaller than the most that would fit.
    const tooBig = lines.length < 3 && size > 76
    if (!tooBig && lines.length * size * LINE_HEIGHT <= TEXT_HEIGHT) return { size, lines }
  }
  ctx.font = fontAt(SMALLEST)
  return { size: SMALLEST, lines: balancedLines(ctx, text, TEXT_WIDTH) }
}

/** Text with letter spacing (canvas `letterSpacing` isn't everywhere yet). */
function spacedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const chars = [...text]
  const widths = chars.map((c) => ctx.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1)
  let at = x - total / 2
  ctx.textAlign = 'left'
  chars.forEach((c, i) => {
    ctx.fillText(c, at, y)
    at += widths[i] + spacing
  })
}

/** "JOHN 3:16 · NIV" */
export const labelOf = (content: CardContent) =>
  `${content.reference}${content.translation ? ` · ${content.translation}` : ''}`.toLocaleUpperCase()

/** Draws the whole card on a canvas of IMAGE_WIDTH × IMAGE_HEIGHT. */
export function drawCard(canvas: HTMLCanvasElement, scene: Scene, content: CardContent) {
  canvas.width = IMAGE_WIDTH
  canvas.height = IMAGE_HEIGHT
  const ctx = canvas.getContext('2d')!
  drawScene(ctx, IMAGE_WIDTH, IMAGE_HEIGHT, scene)

  const { size, lines } = fitVerse(content.text)
  const lineHeight = size * LINE_HEIGHT
  const labelSize = 30
  const gap = 56
  const blockHeight = lines.length * lineHeight + gap + labelSize
  let y = IMAGE_HEIGHT * WORDS_AT - blockHeight / 2

  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 2
  ctx.font = fontAt(size)
  ctx.textAlign = 'center'
  for (const line of lines) {
    ctx.fillText(line, IMAGE_WIDTH / 2, y + lineHeight / 2)
    y += lineHeight
  }

  // A short rule, then the reference.
  y += gap / 2
  ctx.shadowBlur = 8
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
  ctx.fillRect(IMAGE_WIDTH / 2 - 28, y - 1, 56, 2)
  y += gap / 2 + labelSize / 2
  ctx.font = `600 ${labelSize}px ${LABEL_FONT}`
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  spacedText(ctx, labelOf(content), IMAGE_WIDTH / 2, y, labelSize * 0.16)
}

/** Waits (briefly) for the verse font, so measurements and images use it. */
export async function fontReady(): Promise<void> {
  if (!document.fonts?.load) return
  await Promise.race([
    Promise.all([document.fonts.load(fontAt(48)), document.fonts.load(`600 30px ${LABEL_FONT}`)]),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]).catch(() => {})
}

/** The card as a JPEG (a PNG of the grainy scenes would be several megabytes). */
export async function cardImage(scene: Scene, content: CardContent): Promise<Blob> {
  await fontReady()
  const canvas = document.createElement('canvas')
  drawCard(canvas, scene, content)
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the image"))), 'image/jpeg', 0.92),
  )
}

/** "John 3:16" -> "John-3-16.jpg" */
export const imageName = (reference: string) =>
  `${reference.normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'verse'}.jpg`
