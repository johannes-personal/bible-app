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

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
