import { useCallback, useEffect, useState } from 'react'

export interface AsyncState<T> {
  /** Latest loaded value; keeps the previous value while the next one loads. */
  data: T | null
  error: Error | null
  loading: boolean
  retry: () => void
}

interface Settled<T> {
  run: string
  data: T | null
  error: Error | null
}

/** Runs `fn` whenever `key` changes, ignoring results from superseded runs. */
export function useAsync<T>(key: string | null, fn: () => Promise<T>): AsyncState<T> {
  const [settled, setSettled] = useState<Settled<T>>({ run: '', data: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const run = `${key}#${attempt}`

  useEffect(() => {
    if (key == null) return
    let live = true
    fn().then(
      (data) => live && setSettled({ run, data, error: null }),
      (error: Error) => live && setSettled((s) => ({ run, data: s.data, error })),
    )
    return () => {
      live = false
    }
    // `run` covers `key`, and `fn` is derived from it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [run])

  const retry = useCallback(() => setAttempt((a) => a + 1), [])
  const done = settled.run === run
  return {
    data: settled.data,
    error: done ? settled.error : null,
    loading: key != null && !done,
    retry,
  }
}

/** Whether a CSS media query matches, following changes (e.g. rotating a phone). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(query).matches)
  useEffect(() => {
    const list = window.matchMedia?.(query)
    if (!list) return
    const onChange = () => setMatches(list.matches)
    onChange()
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}

/** Whether the device has a connection, following changes. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}
