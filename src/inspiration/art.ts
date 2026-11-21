// The backgrounds of inspiration cards: simple landscapes and soft glows, drawn on a canvas.
// Each passage always gets the same one (its key seeds the choices), at any size, so the card
// on screen and the image saved from it match.

export interface Palette {
  /** Sky from top to horizon. */
  sky: string[]
  /** Sun or moon. */
  light: string
  /** Land or sea, far (hazy) and near (dark). */
  far: string
  near: string
}

const PALETTES: Palette[] = [
  { sky: ['#1e2a5a', '#6b4c8a', '#d97a8a', '#f6b38a'], light: '#ffe3b3', far: '#8d6a9f', near: '#241a3d' }, // dawn
  { sky: ['#141b3d', '#4a2f6b', '#b2496e', '#f08a5d'], light: '#ffd29d', far: '#7c3f6e', near: '#1a1129' }, // dusk
  { sky: ['#0b2545', '#13315c', '#3e7cb1', '#8db8d8'], light: '#fdf6e3', far: '#2f5d8a', near: '#0a1c31' }, // open sky
  { sky: ['#0f3b46', '#1f6f78', '#5fb3a8', '#c9e4c5'], light: '#fff8e1', far: '#2e7d73', near: '#0b2629' }, // morning sea
  { sky: ['#1f2d2a', '#3d5a50', '#7d9c8c', '#c8d8c4'], light: '#f3f0d7', far: '#5e7d6e', near: '#131f1b' }, // misty green
  { sky: ['#3a1f2b', '#8c3f3f', '#d9774b', '#f2b880'], light: '#fff1c9', far: '#b0603f', near: '#331912' }, // desert
  { sky: ['#2b1d2f', '#6d3b5e', '#c46b7a', '#f3c1a5'], light: '#fff0de', far: '#9b5470', near: '#251122' }, // rose
  { sky: ['#1d1b3a', '#4b3f7a', '#8f7fc0', '#d8c7ef'], light: '#fffaf0', far: '#6c5ca8', near: '#181331' }, // lavender
  { sky: ['#1c1f26', '#3b4250', '#7c7466', '#d9b77a'], light: '#ffe7b0', far: '#4c4f58', near: '#101216' }, // gold
]
const NIGHT: Palette[] = [
  { sky: ['#04060f', '#0b1530', '#1b2b55', '#2c4170'], light: '#f4f1de', far: '#1a2747', near: '#04070d' },
  { sky: ['#07050f', '#1a1033', '#3a2358', '#5b3a6e'], light: '#fbf3e4', far: '#2c1d45', near: '#06040c' },
]

export type SceneKind = 'hills' | 'mountains' | 'sea' | 'night' | 'glow' | 'dunes'
const KINDS: [SceneKind, number][] = [
  ['hills', 3],
  ['mountains', 2],
  ['sea', 2],
  ['night', 1],
  ['glow', 1],
  ['dunes', 1],
]

export interface Scene {
  kind: SceneKind
  palette: Palette
  seed: number
}

/** A number from a string, to seed the choices. */
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A small seeded random source (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function sceneFor(key: string): Scene {
  const seed = hashString(key)
  const random = seeded(seed)
  const total = KINDS.reduce((n, [, w]) => n + w, 0)
  let pick = random() * total
  const kind = KINDS.find(([, w]) => (pick -= w) < 0)?.[0] ?? 'hills'
  const palettes = kind === 'night' ? NIGHT : PALETTES
  const palette = palettes[Math.floor(random() * palettes.length)]
  return { kind, palette, seed }
}

/** Two colours of a scene for what surrounds the card on a wide screen. */
export const backdropOf = (scene: Scene) => [scene.palette.sky[1], scene.palette.near] as const

// --- Colour helpers ---

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`
}
const alpha = (hex: string, a: number) => {
  const [r, g, b] = rgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// --- Drawing ---

type Ctx = CanvasRenderingContext2D

function sky(ctx: Ctx, w: number, horizon: number, palette: Palette) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon)
  palette.sky.forEach((c, i) => g.addColorStop(i / (palette.sky.length - 1), c))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, horizon + 2)
}

function glow(ctx: Ctx, x: number, y: number, r: number, color: string, strength: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, alpha(color, strength))
  g.addColorStop(0.35, alpha(color, strength * 0.35))
  g.addColorStop(1, alpha(color, 0))
  ctx.fillStyle = g
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function disc(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/** A crescent moon: the disc with a slightly offset disc taken out of it. */
function crescent(ctx: Ctx, x: number, y: number, r: number, color: string) {
  const size = Math.ceil(r * 2 + 4)
  const moon = document.createElement('canvas')
  moon.width = moon.height = size
  const m = moon.getContext('2d')!
  disc(m, size / 2, size / 2, r, color)
  m.globalCompositeOperation = 'destination-out'
  disc(m, size / 2 + r * 0.42, size / 2 - r * 0.18, r * 0.9, '#000')
  ctx.drawImage(moon, x - size / 2, y - size / 2)
}

/** Fills under a line given by `y(t)` for t from 0 to 1 across the width. */
function fillBelow(ctx: Ctx, w: number, h: number, y: (t: number) => number, fill: string | CanvasGradient) {
  const steps = 120
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let i = 0; i <= steps; i++) ctx.lineTo((i / steps) * w, y(i / steps))
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

/** A gentle line from a few sine waves. */
function rolling(random: () => number, amplitude: number) {
  const waves = [0, 1, 2].map((i) => ({
    f: (0.6 + random() * 0.9) * Math.PI * 2 * (1 + i * 1.8),
    p: random() * Math.PI * 2,
    a: amplitude / (1 + i * 2.2),
  }))
  return (t: number) => waves.reduce((y, v) => y + Math.sin(t * v.f + v.p) * v.a, 0)
}

/** A rugged line by midpoint displacement, sampled 0..1. */
function ridge(random: () => number, amplitude: number, roughness = 0.55) {
  const n = 128
  const ys = new Array<number>(n + 1).fill(0)
  ys[0] = (random() - 0.5) * amplitude
  ys[n] = (random() - 0.5) * amplitude
  let step = n
  let spread = amplitude
  while (step > 1) {
    const half = step / 2
    for (let i = half; i < n; i += step) ys[i] = (ys[i - half] + ys[i + half]) / 2 + (random() - 0.5) * spread
    spread *= roughness
    step = half
  }
  return (t: number) => {
    const x = t * n
    const i = Math.min(n - 1, Math.floor(x))
    return ys[i] + (ys[i + 1] - ys[i]) * (x - i)
  }
}

function layers(
  ctx: Ctx,
  w: number,
  h: number,
  horizon: number,
  palette: Palette,
  count: number,
  line: (i: number) => (t: number) => number,
) {
  // Ground under the horizon, where the nearest line dips below it.
  ctx.fillStyle = palette.far
  ctx.fillRect(0, horizon, w, h - horizon)
  for (let i = 0; i < count; i++) {
    const depth = i / (count - 1)
    const top = horizon + (h - horizon) * (0.04 + depth * 0.5) * (i === 0 ? 0 : 1)
    const color = mix(palette.far, palette.near, Math.pow(depth, 0.8))
    const raw = line(i)
    // The farthest line rests on the horizon rather than dipping below it.
    let lowest = 0
    if (i === 0) for (let t = 0; t <= 1; t += 1 / 60) lowest = Math.max(lowest, raw(t))
    const shape = (t: number) => raw(t) - lowest
    const g = ctx.createLinearGradient(0, top - h * 0.08, 0, h)
    g.addColorStop(0, color)
    g.addColorStop(1, mix(palette.near, '#000000', 0.25 * depth))
    fillBelow(ctx, w, h, (t) => top + shape(t) * h, g)
  }
}

function stars(ctx: Ctx, w: number, h: number, horizon: number, random: () => number) {
  const count = Math.round(260 * (w * h) / (1080 * 1920))
  const unit = w / 1080
  for (let i = 0; i < count; i++) {
    const x = random() * w
    const y = Math.pow(random(), 1.4) * horizon
    const r = (0.6 + random() * random() * 2.2) * unit
    ctx.fillStyle = `rgba(255, 250, 235, ${0.25 + random() * 0.7})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

let grainTile: HTMLCanvasElement | null = null
function grain(ctx: Ctx, w: number, h: number) {
  if (!grainTile) {
    grainTile = document.createElement('canvas')
    grainTile.width = grainTile.height = 160
    const g = grainTile.getContext('2d')!
    const image = g.createImageData(160, 160)
    const random = seeded(7)
    for (let i = 0; i < image.data.length; i += 4) {
      const v = Math.floor(random() * 255)
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v
      image.data[i + 3] = 255
    }
    g.putImageData(image, 0, 0)
  }
  ctx.save()
  ctx.globalAlpha = 0.045
  ctx.globalCompositeOperation = 'overlay'
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat')!
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/** Darkens where the words and controls go, so white text reads on any scene. */
function shade(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, 'rgba(0, 0, 0, 0.32)')
  g.addColorStop(0.12, 'rgba(0, 0, 0, 0.06)')
  g.addColorStop(0.26, 'rgba(0, 0, 0, 0.2)')
  g.addColorStop(0.46, 'rgba(0, 0, 0, 0.3)')
  g.addColorStop(0.66, 'rgba(0, 0, 0, 0.18)')
  g.addColorStop(0.84, 'rgba(0, 0, 0, 0.2)')
  g.addColorStop(1, 'rgba(0, 0, 0, 0.5)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  const v = ctx.createRadialGradient(w / 2, h * 0.44, Math.min(w, h) * 0.35, w / 2, h * 0.44, Math.max(w, h) * 0.75)
  v.addColorStop(0, 'rgba(0, 0, 0, 0)')
  v.addColorStop(1, 'rgba(0, 0, 0, 0.35)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
}

/** Draws `scene` over the whole of a `w` × `h` canvas. */
export function drawScene(ctx: Ctx, w: number, h: number, scene: Scene) {
  const random = seeded(scene.seed ^ 0x9e3779b9)
  const { palette } = scene
  const unit = Math.min(w, h * 0.5625)
  // The sun or moon keeps to one side, away from the middle where the words go.
  const side = random() < 0.5 ? -1 : 1
  const lightX = w * (0.5 + side * (0.2 + random() * 0.17))
  ctx.save()
  switch (scene.kind) {
    case 'hills': {
      const horizon = h * (0.7 + random() * 0.06)
      sky(ctx, w, horizon, palette)
      const r = unit * (0.06 + random() * 0.04)
      glow(ctx, lightX, horizon - r * 0.4, unit * 0.9, palette.light, 0.5)
      disc(ctx, lightX, horizon - r * 0.4, r, alpha(palette.light, 0.92))
      layers(ctx, w, h, horizon, palette, 4, (i) => rolling(random, 0.04 - i * 0.006))
      break
    }
    case 'mountains': {
      const horizon = h * (0.7 + random() * 0.06)
      sky(ctx, w, horizon, palette)
      const r = unit * (0.05 + random() * 0.03)
      glow(ctx, lightX, horizon - unit * 0.2, unit * 0.8, palette.light, 0.45)
      disc(ctx, lightX, horizon - unit * 0.2, r, alpha(palette.light, 0.88))
      layers(ctx, w, h, horizon, palette, 4, (i) => {
        const line = ridge(random, 0.16 - i * 0.03)
        return (t) => line(t) - 0.045 + i * 0.008
      })
      break
    }
    case 'sea': {
      const horizon = h * (0.68 + random() * 0.06)
      sky(ctx, w, horizon, palette)
      const r = unit * (0.05 + random() * 0.04)
      const sunY = horizon - r * (0.2 + random() * 0.9)
      glow(ctx, lightX, sunY, unit * 1, palette.light, 0.6)
      disc(ctx, lightX, sunY, r, alpha(palette.light, 0.95))
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, horizon, w, h - horizon)
      ctx.clip()
      const water = ctx.createLinearGradient(0, horizon, 0, h)
      water.addColorStop(0, mix(palette.sky[palette.sky.length - 1], palette.far, 0.5))
      water.addColorStop(0.35, palette.far)
      water.addColorStop(1, palette.near)
      ctx.fillStyle = water
      ctx.fillRect(0, horizon, w, h - horizon)
      // The light's path on the water, in broken strokes.
      for (let i = 0; i < 70; i++) {
        const depth = Math.pow(random(), 1.6)
        const y = horizon + depth * (h - horizon)
        const spread = r * (0.6 + depth * 3.2)
        const x = lightX + (random() - 0.5) * spread * 2
        const len = (0.2 + random()) * r * (0.5 + depth * 2.5)
        ctx.fillStyle = alpha(palette.light, (0.5 - depth * 0.4) * (0.4 + random() * 0.6))
        ctx.fillRect(x - len / 2, y, len, Math.max(1, unit * 0.004 * (1 + depth * 2)))
      }
      ctx.restore()
      // A distant shore, sometimes.
      if (random() < 0.5) {
        const line = rolling(random, 0.012)
        const from = random() < 0.5 ? 0 : 0.55
        fillBelow(ctx, w, horizon + 1, (t) => (t >= from && t <= from + 0.45 ? horizon - Math.abs(line(t)) * h - h * 0.006 : horizon + 1), mix(palette.far, palette.near, 0.55))
      }
      break
    }
    case 'night': {
      const horizon = h * (0.74 + random() * 0.06)
      sky(ctx, w, horizon, palette)
      stars(ctx, w, h, horizon, random)
      const r = unit * (0.04 + random() * 0.025)
      const moonY = h * (0.13 + random() * 0.06)
      glow(ctx, lightX, moonY, unit * 0.6, palette.light, 0.35)
      if (random() < 0.6) crescent(ctx, lightX, moonY, r, palette.light)
      else disc(ctx, lightX, moonY, r, palette.light)
      layers(ctx, w, h, horizon, palette, 2, (i) => rolling(random, 0.03 - i * 0.01))
      break
    }
    case 'glow': {
      ctx.fillStyle = palette.sky[1]
      ctx.fillRect(0, 0, w, h)
      const colors = [palette.sky[0], palette.sky[2], palette.sky[3], palette.light, palette.far]
      for (let i = 0; i < 6; i++) {
        const c = colors[Math.floor(random() * colors.length)]
        glow(ctx, random() * w, random() * h, unit * (0.7 + random() * 0.9), c, 0.55 + random() * 0.35)
      }
      break
    }
    case 'dunes': {
      const horizon = h * (0.7 + random() * 0.06)
      sky(ctx, w, horizon, palette)
      const r = unit * (0.06 + random() * 0.04)
      glow(ctx, lightX, horizon - r * 0.6, unit * 0.9, palette.light, 0.45)
      disc(ctx, lightX, horizon - r * 0.6, r, alpha(palette.light, 0.9))
      layers(ctx, w, h, horizon, palette, 5, (i) => {
        const f = (1.2 + random() * 1.2) * Math.PI
        const p = random() * Math.PI * 2
        const a = 0.035 + random() * 0.025
        return (t) => Math.sin(t * f + p) * a + Math.sin(t * f * 2.3 + p) * a * 0.25 - 0.02 + i * 0.004
      })
      break
    }
  }
  ctx.restore()
  shade(ctx, w, h)
  grain(ctx, w, h)
}
