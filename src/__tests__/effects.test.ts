import { describe, expect, it } from 'vitest'

// React calls whatever an effect returns as its cleanup. An expression-bodied effect like
// `useEffect(() => window.scrollTo(0, 0))` returns the call's result, and newer browsers make
// scrollTo() return a Promise, which crashed the app on the next chapter change. Effects must
// use a block body (or return a cleanup function explicitly).
const EXPRESSION_EFFECT = /use(?:Layout)?Effect\(\s*\(\)\s*=>(?!\s*[{(])/g

const sources = import.meta.glob<string>(['../**/*.{ts,tsx}', '!../__tests__/**'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe('effects', () => {
  it('never return the value of an expression', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10)
    const offenders = Object.entries(sources).flatMap(([file, code]) =>
      [...code.matchAll(EXPRESSION_EFFECT)].map((m) => `${file}: ${m[0]}`),
    )
    expect(offenders).toEqual([])
  })
})
