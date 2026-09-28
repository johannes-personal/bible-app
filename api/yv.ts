// Proxy for the YouVersion Platform API (https://developers.youversion.com).
// The app key stays on the server: the browser calls /api/yv?path=bibles/…, and this
// function adds the X-YVP-App-Key header. Only read-only Bible routes are allowed.

const BASE = 'https://api.youversion.com/v1/'

// bibles, bibles/{id}, bibles/{id}/index, bibles/{id}/books, bibles/{id}/passages/{ref}
const ALLOWED = /^bibles(\/\d+(\/(index|books|passages\/[A-Za-z0-9.+-]+))?)?$/

export async function GET(request: Request): Promise<Response> {
  const key = process.env.YOUVERSION_APP_KEY
  if (!key) return json({ error: 'YouVersion is not configured' }, 503)

  const url = new URL(request.url)
  if (url.searchParams.has('catalog')) return catalog(key)
  const path = url.searchParams.get('path') ?? ''
  if (!ALLOWED.test(path)) return json({ error: 'Unsupported path' }, 400)

  const upstream = new URL(path, BASE)
  url.searchParams.forEach((value, name) => {
    if (name !== 'path') upstream.searchParams.append(name, value)
  })

  const res = await fetch(upstream, { headers: { 'X-YVP-App-Key': key, Accept: 'application/json' } })
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      // Let Vercel's CDN cache successful responses for a day; Bible text rarely changes.
      'Cache-Control': res.ok ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'no-store',
    },
  })
}

interface Bible {
  id: number
  abbreviation: string
  localized_abbreviation: string
  title: string
  localized_title: string
  language_tag: string
  books: string[]
}

/** A catalogue entry; `books` is the number of books rather than their list. */
type CatalogEntry = Omit<Bible, 'books'> & { books: number }

/**
 * Every Bible available to the app key, trimmed to the fields the app needs. The API pages
 * at most 99 per request, so this collects all pages here instead of in the browser.
 */
async function catalog(key: string): Promise<Response> {
  const bibles: CatalogEntry[] = []
  let token: string | undefined
  for (let page = 0; page < 50; page++) {
    const upstream = new URL('bibles', BASE)
    upstream.searchParams.append('language_ranges[]', '*')
    upstream.searchParams.set('page_size', '99')
    if (token) upstream.searchParams.set('page_token', token)
    const res = await fetch(upstream, { headers: { 'X-YVP-App-Key': key, Accept: 'application/json' } })
    if (!res.ok) return json({ error: `YouVersion responded ${res.status}` }, 502)
    const body = (await res.json()) as { data: Bible[]; next_page_token?: string | null }
    for (const b of body.data) {
      bibles.push({
        id: b.id,
        abbreviation: b.abbreviation,
        localized_abbreviation: b.localized_abbreviation,
        title: b.title,
        localized_title: b.localized_title,
        language_tag: b.language_tag,
        books: b.books?.length ?? 0,
      })
    }
    token = body.next_page_token ?? undefined
    if (!token) break
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
