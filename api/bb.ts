// Proxy for the Bible Brain API (Faith Comes By Hearing, https://4.dbt.io, also called the
// Digital Bible Platform). The key stays on the server: the browser calls /api/bb?path=…,
// and this function adds it. Only read-only Bible, fileset and timestamp routes are allowed.
//
//   /api/bb?catalog=1                  Bibles with text or audio, trimmed (see `catalog`)
//   /api/bb?path=bibles/NLDHSV/book    passthrough for the allowed routes below
//   /api/bb?audio=NLDHSVN1DA/JHN/3     redirects to the chapter's (signed, expiring) mp3

const BASE = 'https://4.dbt.io/api/'

/** Fetches from Bible Brain, retrying twice on rate limiting, server errors and network failures. */
async function upstreamFetch(url: URL, key: string): Promise<Response> {
  url.searchParams.set('v', '4')
  url.searchParams.set('key', key)
  const delays = [300, 900]
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      const transient = res.status === 429 || res.status >= 500
      if (!transient || attempt >= delays.length) return res
    } catch (e) {
      if (attempt >= delays.length) throw e
    }
    await new Promise((r) => setTimeout(r, delays[attempt]))
  }
}

const ID = '[A-Za-z0-9_-]+'
const BOOK = '[A-Z0-9]{3}'
// bibles/{id}, bibles/{id}/book, bibles/{id}/copyright,
// bibles/filesets/{fileset}/{book}/{chapter}, timestamps/{fileset}/{book}/{chapter}
const ALLOWED = new RegExp(
  `^(bibles/${ID}(/book|/copyright)?|bibles/filesets/${ID}/${BOOK}/\\d+|timestamps/${ID}/${BOOK}/\\d+)$`,
)
const AUDIO = new RegExp(`^(${ID})/(${BOOK})/(\\d+)$`)
/** Query parameters passed on to Bible Brain. */
const PARAMS = new Set(['verify_content', 'verse_count'])

export async function GET(request: Request): Promise<Response> {
  const key = process.env.BIBLE_BRAIN_KEY
  if (!key) return json({ error: 'Bible Brain is not configured' }, 503)

  const url = new URL(request.url)
  if (url.searchParams.has('catalog')) return catalog(key)
  if (url.searchParams.has('audio')) return audio(key, url.searchParams.get('audio') ?? '')

  const path = url.searchParams.get('path') ?? ''
  if (!ALLOWED.test(path)) return json({ error: 'Unsupported path' }, 400)
  const upstream = new URL(path, BASE)
  url.searchParams.forEach((value, name) => {
    if (PARAMS.has(name)) upstream.searchParams.set(name, value)
  })

  const res = await upstreamFetch(upstream, key)
  // Error bodies aren't passed on, in case one echoes the request (and with it the key).
  if (!res.ok) return json({ error: `Bible Brain responded ${res.status}` }, res.status)
  return new Response(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      // Text and metadata rarely change. Fileset responses can hold signed audio links, which expire.
      'Cache-Control': path.startsWith('bibles/filesets/')
        ? 'public, s-maxage=300'
        : 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  })
}

/**
 * Redirects to the mp3 for one chapter of an audio fileset. Bible Brain hands out signed links
 * that expire, so the app links here and every load gets a fresh one.
 */
async function audio(key: string, ref: string): Promise<Response> {
  const m = AUDIO.exec(ref)
  if (!m) return json({ error: 'Unsupported audio reference' }, 400)
  const [, fileset, book, chapter] = m
  const res = await upstreamFetch(new URL(`bibles/filesets/${fileset}/${book}/${chapter}`, BASE), key)
  if (!res.ok) return json({ error: `Bible Brain responded ${res.status}` }, res.status === 404 ? 404 : 502)
  const body = (await res.json()) as { data?: { path?: string }[] }
  const location = body.data?.find((d) => d.path)?.path
  if (!location) return json({ error: 'No audio for this chapter' }, 404)
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': 'public, s-maxage=300' },
  })
}

interface UpstreamFileset {
  id: string
  set_type_code: string
  set_size_code: string
}

interface UpstreamBible {
  abbr: string
  name: string
  vname?: string | null
  language: string
  language_autonym?: string | null
  iso: string
  date?: number | null
  filesets?: Record<string, UpstreamFileset[]>
}

export interface CatalogFileset {
  id: string
  type: 'text_plain' | 'audio' | 'audio_drama'
  /** Which part of the Bible it covers: "C" (complete), "NT", "OT", "NTP" (partial NT), "NTOTP"… */
  size: string
  /** Has per-verse audio timestamps. */
  timed?: boolean
}

export interface CatalogEntry {
  id: string
  name: string
  vname?: string
  language: string
  autonym?: string
  iso: string
  filesets: CatalogFileset[]
}

const TYPES = new Set(['text_plain', 'audio', 'audio_drama'])

/**
 * Keeps the filesets the app can use: plain text, and mp3 audio (not the Opus or streaming
 * copies of the same recordings). Bibles with none of those are left out.
 */
export function trimBible(b: UpstreamBible, timed: Set<string>): CatalogEntry | null {
  const filesets = (b.filesets?.['dbp-prod'] ?? [])
    .filter((f) => TYPES.has(f.set_type_code) && !/opus|stream/i.test(f.id))
    .map((f): CatalogFileset => ({
      id: f.id,
      type: f.set_type_code as CatalogFileset['type'],
      size: f.set_size_code,
      ...(timed.has(f.id) ? { timed: true } : {}),
    }))
  if (!filesets.length) return null
  return {
    id: b.abbr,
    name: b.name,
    ...(b.vname && b.vname !== b.name ? { vname: b.vname } : {}),
    language: b.language,
    ...(b.language_autonym ? { autonym: b.language_autonym } : {}),
    iso: b.iso,
    filesets,
  }
}

/** Every Bible the key can use, with its usable filesets, collected here instead of in the browser. */
async function catalog(key: string): Promise<Response> {
  const timedRes = await upstreamFetch(new URL('timestamps', BASE), key)
  if (!timedRes.ok) return json({ error: `Bible Brain responded ${timedRes.status}` }, 502)
  const timedBody = (await timedRes.json()) as { data?: { fileset_id: string }[] } | { fileset_id: string }[]
  const timedList = Array.isArray(timedBody) ? timedBody : (timedBody.data ?? [])
  const timed = new Set(timedList.map((t) => t.fileset_id))

  const bibles: CatalogEntry[] = []
  for (let page = 1; page <= 40; page++) {
    const upstream = new URL('bibles', BASE)
    upstream.searchParams.set('limit', '500')
    upstream.searchParams.set('page', String(page))
    const res = await upstreamFetch(upstream, key)
    if (!res.ok) return json({ error: `Bible Brain responded ${res.status}` }, 502)
    const body = (await res.json()) as {
      data: UpstreamBible[]
      meta?: { pagination?: { current_page?: number; total_pages?: number } }
    }
    for (const b of body.data) {
      const entry = trimBible(b, timed)
      if (entry) bibles.push(entry)
    }
    const p = body.meta?.pagination
    if (!body.data.length || !p?.total_pages || page >= p.total_pages) break
  }
  return new Response(JSON.stringify(bibles), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400',
    },
  })
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
