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
