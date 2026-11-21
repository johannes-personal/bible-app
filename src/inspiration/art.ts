// The backgrounds of inspiration cards: landscapes, skies and soft glows, drawn on a canvas.
// Which kind of scene suits a passage is worked out from its words when the verse list is built
// (scripts/build-inspiration.mjs): still waters get a lake, a storm gets rain, "the heavens" a
// sky. The passage's key seeds the rest (the colours, where the sun is), so each passage always
// looks the same, at any size: the card on screen and the image saved from it match.

export interface Palette {
  /** Sky from top to horizon. */
  sky: string[]
  /** Sun or moon. */
  light: string
  /** Land or sea, far (hazy) and near (dark). */
  far: string
  near: string
}

const DAWN: Palette = { sky: ['#1e2a5a', '#6b4c8a', '#d97a8a', '#f6b38a'], light: '#ffe3b3', far: '#8d6a9f', near: '#241a3d' }
const DUSK: Palette = { sky: ['#141b3d', '#4a2f6b', '#b2496e', '#f08a5d'], light: '#ffd29d', far: '#7c3f6e', near: '#1a1129' }
const OPEN_SKY: Palette = { sky: ['#0b2545', '#13315c', '#3e7cb1', '#8db8d8'], light: '#fdf6e3', far: '#2f5d8a', near: '#0a1c31' }
const MORNING_SEA: Palette = { sky: ['#0f3b46', '#1f6f78', '#5fb3a8', '#c9e4c5'], light: '#fff8e1', far: '#2e7d73', near: '#0b2629' }
const MIST: Palette = { sky: ['#1f2d2a', '#3d5a50', '#7d9c8c', '#c8d8c4'], light: '#f3f0d7', far: '#5e7d6e', near: '#131f1b' }
const DESERT: Palette = { sky: ['#3a1f2b', '#8c3f3f', '#d9774b', '#f2b880'], light: '#fff1c9', far: '#b0603f', near: '#331912' }
const ROSE: Palette = { sky: ['#2b1d2f', '#6d3b5e', '#c46b7a', '#f3c1a5'], light: '#fff0de', far: '#9b5470', near: '#251122' }
const LAVENDER: Palette = { sky: ['#1d1b3a', '#4b3f7a', '#8f7fc0', '#d8c7ef'], light: '#fffaf0', far: '#6c5ca8', near: '#181331' }
const GOLD: Palette = { sky: ['#1c1f26', '#3b4250', '#7c7466', '#d9b77a'], light: '#ffe7b0', far: '#4c4f58', near: '#101216' }
const MEADOW: Palette = { sky: ['#17395a', '#3f7aa6', '#9cc8dc', '#eee3bd'], light: '#fff6d8', far: '#6f9a5c', near: '#1d3118' }
const HARVEST: Palette = { sky: ['#2d2140', '#8a4d63', '#dc915f', '#f6d38f'], light: '#fff3cf', far: '#b48a3c', near: '#33230f' }
const STORM: Palette = { sky: ['#161b26', '#2c3646', '#566275', '#9aa6b4'], light: '#fdf1cf', far: '#3a4452', near: '#10141b' }
const STORM_GREEN: Palette = { sky: ['#141d1d', '#2a3b3a', '#53696a', '#a3b3ac'], light: '#f6f0d6', far: '#3a4d48', near: '#0e1615' }
const NIGHT_BLUE: Palette = { sky: ['#04060f', '#0b1530', '#1b2b55', '#2c4170'], light: '#f4f1de', far: '#1a2747', near: '#04070d' }
const NIGHT_VIOLET: Palette = { sky: ['#07050f', '#1a1033', '#3a2358', '#5b3a6e'], light: '#fbf3e4', far: '#2c1d45', near: '#06040c' }

const DAY = [DAWN, DUSK, OPEN_SKY, MORNING_SEA, MIST, DESERT, ROSE, LAVENDER, GOLD]

export const SCENE_KINDS = [
  'hills',
  'mountains',
  'sea',
  'night',
  'glow',
  'dunes',
  'sunrise',
  'sky',
  'lake',
  'forest',
  'meadow',
  'rain',
  'rainbow',
  'path',
] as const
export type SceneKind = (typeof SCENE_KINDS)[number]

/** The colours each kind of scene is drawn in. */
const PALETTES: Record<SceneKind, Palette[]> = {
  hills: [...DAY, MEADOW, HARVEST],
  mountains: DAY,
  sea: [DAWN, DUSK, OPEN_SKY, MORNING_SEA, ROSE, LAVENDER, GOLD],
  night: [NIGHT_BLUE, NIGHT_VIOLET],
  glow: [DAWN, DUSK, ROSE, LAVENDER, GOLD, MORNING_SEA],
  dunes: [DESERT, GOLD, DUSK, ROSE, HARVEST],
  sunrise: [DAWN, DUSK, ROSE, GOLD, DESERT, LAVENDER, HARVEST],
  sky: [OPEN_SKY, LAVENDER, MORNING_SEA, ROSE, DAWN, MEADOW],
  lake: [MIST, MORNING_SEA, OPEN_SKY, DAWN, LAVENDER, ROSE],
  forest: [MIST, MORNING_SEA, GOLD, LAVENDER, DUSK, MEADOW],
  meadow: [MEADOW, HARVEST, MORNING_SEA, DAWN, GOLD],
  rain: [STORM, STORM_GREEN, MIST, OPEN_SKY],
  rainbow: [STORM, STORM_GREEN, OPEN_SKY, MIST],
  path: [...DAY, MEADOW, HARVEST],
}

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

/** A passage's scene: of the kind chosen for it (or any), in colours its key picks. */
export function sceneFor(key: string, kind?: SceneKind): Scene {
  const seed = hashString(key)
  const random = seeded(seed)
  const chosen = kind ?? SCENE_KINDS[Math.floor(random() * SCENE_KINDS.length)]
  const palettes = PALETTES[chosen]
  return { kind: chosen, palette: palettes[Math.floor(random() * palettes.length)], seed }
}

/** Two colours of a scene for what surrounds the card on a wide screen. */
export const backdropOf = (scene: Scene) => [scene.palette.sky[1], scene.palette.near] as const

// --- Colour helpers ---

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
/** The colour `t` of the way from `a` to `b`, as "#rrggbb". */
const mix = (a: string, b: string, t: number) => {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`
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

/** The light's path on water below the horizon, in broken strokes. */
function glitter(ctx: Ctx, h: number, horizon: number, x0: number, r: number, color: string, unit: number, random: () => number) {
  for (let i = 0; i < 70; i++) {
    const depth = Math.pow(random(), 1.6)
    const y = horizon + depth * (h - horizon)
    const spread = r * (0.6 + depth * 3.2)
    const x = x0 + (random() - 0.5) * spread * 2
    const len = (0.2 + random()) * r * (0.5 + depth * 2.5)
    ctx.fillStyle = alpha(color, (0.5 - depth * 0.4) * (0.4 + random() * 0.6))
    ctx.fillRect(x - len / 2, y, len, Math.max(1, unit * 0.004 * (1 + depth * 2)))
  }
}

/** Beams of light fanning out from (x, y) between the angles `from` and `to`. */
function rays(ctx: Ctx, x: number, y: number, length: number, color: string, strength: number, random: () => number, from: number, to: number, count: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  for (let i = 0; i < count; i++) {
    const a = from + ((to - from) * (i + 0.5 + (random() - 0.5) * 0.7)) / count
    const spread = 0.02 + random() * 0.035
    const g = ctx.createRadialGradient(x, y, 0, x, y, length)
    g.addColorStop(0, alpha(color, strength))
    g.addColorStop(1, alpha(color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(a - spread) * length, y + Math.sin(a - spread) * length)
    ctx.lineTo(x + Math.cos(a + spread) * length, y + Math.sin(a + spread) * length)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/** A cloud: round puffs along a flat base, fuller in the middle, with a little shade under. */
function cloud(ctx: Ctx, x: number, y: number, width: number, color: string, strength: number, random: () => number, shadow?: string) {
  const puffs = 9 + Math.floor(random() * 6)
  const shapes = Array.from({ length: puffs }, (_, i) => {
    const t = i / (puffs - 1)
    const r = width * (0.08 + 0.12 * Math.sin(t * Math.PI)) * (0.8 + random() * 0.4)
    return { x: x + (t - 0.5) * width * 0.8, y: y - r * 0.45 * Math.sin(t * Math.PI) - random() * r * 0.25, r }
  })
  const puff = (p: { x: number; y: number; r: number }, c: string, a: number, dy: number) => {
    const g = ctx.createRadialGradient(p.x, p.y + dy, 0, p.x, p.y + dy, p.r)
    g.addColorStop(0, alpha(c, a * 0.75))
    g.addColorStop(0.45, alpha(c, a * 0.55))
    g.addColorStop(1, alpha(c, 0))
    ctx.fillStyle = g
    ctx.fillRect(p.x - p.r, p.y + dy - p.r, p.r * 2, p.r * 2)
  }
  if (shadow) for (const p of shapes) puff(p, shadow, strength * 0.5, p.r * 0.35)
  for (const p of shapes) puff(p, color, strength, 0)
}

/** A row of pine trees standing on `base`, up to `height` tall, filled down to the bottom. */
function pines(ctx: Ctx, w: number, h: number, base: number, height: number, fill: string | CanvasGradient, random: () => number) {
  ctx.fillStyle = fill
  ctx.beginPath()
  let x = -random() * height * 0.3
  while (x < w + height * 0.3) {
    const th = height * (0.5 + random() * 0.5)
    const half = th * (0.17 + random() * 0.05)
    const tiers = 4
    const top = base - th
    // Up the left side in steps, down the right.
    ctx.moveTo(x, top)
    for (let k = 1; k <= tiers; k++) {
      const y = top + (th * 0.85 * k) / tiers
      ctx.lineTo(x - (half * k) / tiers, y)
      if (k < tiers) ctx.lineTo(x - (half * k) / tiers * 0.45, y - th * 0.03)
    }
    ctx.lineTo(x - half * 0.12, base - th * 0.15)
    ctx.lineTo(x - half * 0.12, base + 2)
    ctx.lineTo(x + half * 0.12, base + 2)
    ctx.lineTo(x + half * 0.12, base - th * 0.15)
    for (let k = tiers; k >= 1; k--) {
      const y = top + (th * 0.85 * k) / tiers
      if (k < tiers) ctx.lineTo(x + (half * k) / tiers * 0.45, y - th * 0.03)
      ctx.lineTo(x + (half * k) / tiers, y)
    }
    ctx.closePath()
    x += half * (0.9 + random() * 1.1)
  }
  ctx.rect(0, base, w, h - base)
  ctx.fill()
}

/** Blades of grass growing up from the bottom of the picture. */
function grass(ctx: Ctx, w: number, h: number, from: number, color: string, random: () => number, count: number) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  for (let i = 0; i < count; i++) {
    const depth = random()
    const y = from + depth * (h - from) + h * 0.02
    const x = random() * w
    const len = h * (0.025 + random() * 0.045) * (0.5 + depth)
    const bend = (random() - 0.5) * len * 0.7
    ctx.lineWidth = Math.max(1, w * 0.0022 * (0.6 + depth))
    ctx.globalAlpha = 0.55 + depth * 0.4
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + bend * 0.2, y - len * 0.6, x + bend, y - len)
    ctx.stroke()
  }
  ctx.restore()
}

/** Falling rain, slanting a little. */
function rainfall(ctx: Ctx, w: number, h: number, color: string, random: () => number, count: number) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1, w * 0.0016)
  for (let i = 0; i < count; i++) {
    const x = random() * w * 1.2 - w * 0.1
    const y = random() * h * 0.9
    const len = h * (0.02 + random() * 0.035)
    ctx.globalAlpha = 0.08 + random() * 0.14
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x - len * 0.22, y + len)
    ctx.stroke()
  }
  ctx.restore()
}

function rainbowArc(ctx: Ctx, cx: number, cy: number, r: number, band: number, strength: number) {
  const colors = ['#ff6b6b', '#ffa94d', '#ffe066', '#8ce99a', '#74c0fc', '#9775fa']
  ctx.save()
  ctx.globalCompositeOperation = 'screen'
  ctx.lineWidth = band
  colors.forEach((c, i) => {
    ctx.strokeStyle = alpha(c, strength)
    ctx.beginPath()
    ctx.arc(cx, cy, r - i * band, Math.PI, Math.PI * 2)
    ctx.stroke()
  })
  ctx.restore()
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
      glitter(ctx, h, horizon, lightX, r, palette.light, unit, random)
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
    case 'sunrise': {
      const horizon = h * (0.72 + random() * 0.05)
      sky(ctx, w, horizon, palette)
      const sunX = w * (0.5 + side * (0.08 + random() * 0.18))
      const r = unit * (0.08 + random() * 0.04)
      rays(ctx, sunX, horizon, h * 0.95, palette.light, 0.2, random, Math.PI * 1.02, Math.PI * 1.98, 13)
      glow(ctx, sunX, horizon, unit * 1.1, palette.light, 0.6)
      disc(ctx, sunX, horizon, r, alpha(palette.light, 0.95))
      cloud(ctx, w * (0.2 + random() * 0.6), horizon - h * (0.06 + random() * 0.06), w * 0.6, palette.sky[3], 0.3, random)
      if (random() < 0.5) {
        // Over the sea: the sun's path on the water.
        const water = ctx.createLinearGradient(0, horizon, 0, h)
        water.addColorStop(0, mix(palette.sky[palette.sky.length - 1], palette.far, 0.45))
        water.addColorStop(0.4, palette.far)
        water.addColorStop(1, palette.near)
        ctx.fillStyle = water
        ctx.fillRect(0, horizon, w, h - horizon)
        glitter(ctx, h, horizon, sunX, r, palette.light, unit, random)
      } else {
        // Over a plain.
        layers(ctx, w, h, horizon, palette, 3, (i) => rolling(random, 0.004 + i * 0.002))
      }
      break
    }
    case 'sky': {
      sky(ctx, w, h, palette)
      const sourceX = w * (0.5 + side * (0.25 + random() * 0.2))
      rays(ctx, sourceX, -h * 0.08, h * 1.1, palette.light, 0.12, random, Math.PI * 0.3, Math.PI * 0.7, 7)
      glow(ctx, sourceX, 0, unit * 0.9, palette.light, 0.4)
      const shadow = mix(palette.sky[1], palette.near, 0.3)
      for (let i = 0; i < 2; i++) cloud(ctx, random() * w, h * (0.08 + random() * 0.14), w * (0.35 + random() * 0.3), palette.light, 0.3, random)
      for (let i = 0; i < 5; i++) {
        const y = h * (0.68 + (i / 4) * 0.26 + (random() - 0.5) * 0.04)
        cloud(ctx, w * (0.1 + random() * 0.8), y, w * (0.45 + random() * 0.5), mix(palette.sky[3], palette.light, 0.3), 0.75, random, shadow)
      }
      break
    }
    case 'lake': {
      const horizon = h * (0.6 + random() * 0.05)
      sky(ctx, w, horizon, palette)
      const r = unit * (0.05 + random() * 0.03)
      const lightY = horizon - unit * (0.05 + random() * 0.09)
      glow(ctx, lightX, lightY, unit * 0.9, palette.light, 0.5)
      disc(ctx, lightX, lightY, r, alpha(palette.light, 0.92))
      // Still water: the sky turned upside down, a little darker.
      const water = ctx.createLinearGradient(0, horizon, 0, h)
      const n = palette.sky.length
      water.addColorStop(0, mix(palette.sky[n - 1], palette.far, 0.25))
      water.addColorStop(0.45, mix(palette.sky[n - 2], palette.near, 0.35))
      water.addColorStop(1, mix(palette.sky[0], palette.near, 0.6))
      ctx.fillStyle = water
      ctx.fillRect(0, horizon, w, h - horizon)
      // The light's reflection, and the far shore with its own.
      for (let i = 0; i < 45; i++) {
        const depth = random()
        const y = horizon + depth * (h - horizon) * 0.85
        const len = r * (1 + depth * 1.6) * (0.5 + random())
        ctx.fillStyle = alpha(palette.light, (0.42 - depth * 0.36) * (0.5 + random() * 0.5))
        ctx.fillRect(lightX - len / 2 + (random() - 0.5) * r * 0.6, y, len, Math.max(1, unit * 0.005))
      }
      const shore = rolling(random, 0.02)
      const rise = (t: number) => (Math.abs(shore(t)) + 0.006) * h
      fillBelow(ctx, w, horizon + 1, (t) => horizon - rise(t), mix(palette.far, palette.near, 0.35))
      ctx.save()
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.moveTo(0, horizon)
      for (let i = 0; i <= 120; i++) ctx.lineTo((i / 120) * w, horizon + rise(i / 120) * 0.9)
      ctx.lineTo(w, horizon)
      ctx.closePath()
      ctx.fillStyle = mix(palette.far, palette.near, 0.5)
      ctx.fill()
      ctx.restore()
      // Faint ripples.
      for (let i = 0; i < 60; i++) {
        const depth = random()
        const y = horizon + depth * (h - horizon)
        const len = w * (0.05 + random() * 0.2) * (0.4 + depth)
        ctx.fillStyle = alpha(palette.light, 0.04 + random() * 0.07)
        ctx.fillRect(random() * w - len / 2, y, len, Math.max(1, unit * 0.003))
      }
      break
    }
    case 'forest': {
      sky(ctx, w, h * 0.8, palette)
      ctx.fillStyle = palette.sky[palette.sky.length - 1]
      ctx.fillRect(0, h * 0.8, w, h * 0.2)
      const sourceX = w * (0.5 + side * (0.2 + random() * 0.2))
      glow(ctx, sourceX, h * 0.18, unit * 1, palette.light, 0.5)
      rays(ctx, sourceX, h * 0.12, h * 0.9, palette.light, 0.1, random, Math.PI * 0.25, Math.PI * 0.75, 6)
      const mistColor = palette.sky[palette.sky.length - 1]
      for (let i = 0; i < 4; i++) {
        const depth = i / 3
        const base = h * (0.6 + depth * 0.32)
        const height = h * (0.12 + depth * 0.1)
        pines(ctx, w, h, base, height, mix(mix(palette.far, mistColor, 0.45 - depth * 0.45), palette.near, depth * 0.85), random)
        // Mist between the rows.
        const fog = ctx.createLinearGradient(0, base - height * 0.7, 0, base + h * 0.02)
        fog.addColorStop(0, alpha(mistColor, 0))
        fog.addColorStop(1, alpha(mistColor, 0.22 * (1 - depth)))
        ctx.fillStyle = fog
        ctx.fillRect(0, base - height * 0.7, w, height * 0.7 + h * 0.02)
      }
      break
    }
    case 'meadow': {
      const horizon = h * (0.68 + random() * 0.05)
      sky(ctx, w, horizon, palette)
      const r = unit * (0.05 + random() * 0.03)
      const lightY = horizon - unit * (0.08 + random() * 0.1)
      glow(ctx, lightX, lightY, unit * 1, palette.light, 0.5)
      disc(ctx, lightX, lightY, r, alpha(palette.light, 0.9))
      cloud(ctx, w * (0.15 + random() * 0.7), h * (0.12 + random() * 0.08), w * 0.45, palette.light, 0.3, random)
      layers(ctx, w, h, horizon, palette, 3, (i) => rolling(random, 0.008 - i * 0.002))
      const flowers = [palette.light, '#f6b8c8', '#ffffff', '#f7d774', '#c9b6f2']
      for (let i = 0; i < 70; i++) {
        const depth = Math.pow(random(), 0.7)
        const y = horizon + (h - horizon) * (0.25 + depth * 0.75)
        ctx.fillStyle = alpha(flowers[Math.floor(random() * flowers.length)], 0.55 + depth * 0.35)
        ctx.beginPath()
        ctx.arc(random() * w, y, unit * (0.003 + depth * 0.007), 0, Math.PI * 2)
        ctx.fill()
      }
      grass(ctx, w, h, h * 0.84, mix(palette.near, palette.far, 0.25), random, 240)
      break
    }
    case 'rain':
    case 'rainbow': {
      const horizon = h * (0.76 + random() * 0.05)
      sky(ctx, w, horizon, palette)
      const breakX = w * (0.5 + side * (0.15 + random() * 0.25))
      glow(ctx, breakX, h * 0.3, unit * 1.1, palette.light, scene.kind === 'rainbow' ? 0.45 : 0.3)
      rays(ctx, breakX, h * 0.22, h * 0.8, palette.light, 0.08, random, Math.PI * 0.3, Math.PI * 0.7, 5)
      if (scene.kind === 'rainbow') rainbowArc(ctx, w * (0.5 - side * 0.15), horizon * 1.04, unit * (0.8 + random() * 0.2), unit * 0.03, 0.28)
      for (let i = 0; i < 7; i++) cloud(ctx, random() * w, h * (0.03 + random() * 0.2), w * (0.6 + random() * 0.6), palette.near, 0.55, random)
      rainfall(ctx, w, horizon, palette.light, random, scene.kind === 'rainbow' ? 90 : 260)
      layers(ctx, w, h, horizon, palette, 2, (i) => rolling(random, 0.008 - i * 0.003))
      break
    }
    case 'path': {
      const horizon = h * (0.62 + random() * 0.05)
      sky(ctx, w, horizon, palette)
      const r = unit * (0.05 + random() * 0.03)
      glow(ctx, lightX, horizon - r * 0.5, unit * 0.9, palette.light, 0.5)
      disc(ctx, lightX, horizon - r * 0.5, r, alpha(palette.light, 0.92))
      layers(ctx, w, h, horizon, palette, 4, (i) => rolling(random, 0.03 - i * 0.005))
      // A path winding from the bottom of the picture into the distance.
      const startX = w * (0.5 + (random() - 0.5) * 0.2)
      const endX = w * (0.5 + side * (0.08 + random() * 0.12))
      const turns = 1.2 + random() * 0.8
      const phase = random() * Math.PI * 2
      const vanish = horizon + (h - horizon) * 0.08
      const at = (s: number) => {
        const y = h + 2 - (h + 2 - vanish) * (1 - Math.pow(1 - s, 1.8))
        const x = startX + (endX - startX) * s + Math.sin(s * Math.PI * turns + phase) * w * 0.16 * (1 - s)
        const half = w * 0.2 * Math.pow(1 - s, 1.6) + w * 0.003
        return { x, y, half }
      }
      const steps = 60
      ctx.beginPath()
      for (let i = 0; i <= steps; i++) {
        const p = at(i / steps)
        if (i === 0) ctx.moveTo(p.x - p.half, p.y)
        else ctx.lineTo(p.x - p.half, p.y)
      }
      for (let i = steps; i >= 0; i--) {
        const p = at(i / steps)
        ctx.lineTo(p.x + p.half, p.y)
      }
      ctx.closePath()
      const trail = ctx.createLinearGradient(0, vanish, 0, h)
      trail.addColorStop(0, alpha(palette.light, 0.55))
      trail.addColorStop(1, mix(palette.far, palette.light, 0.35))
      ctx.fillStyle = trail
      ctx.globalAlpha = 0.5
      ctx.fill()
      ctx.globalAlpha = 1
      break
    }
  }
  ctx.restore()
  shade(ctx, w, h)
  grain(ctx, w, h)
}
