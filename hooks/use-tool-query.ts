import { useEffect, useRef, useState } from 'react'

/** Retry an explicit failed tool read without replacing previously loaded data with empty state. */
export function useToolQuery<T>(key: string, load: (key: string) => Promise<T>, message: string) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [retryToken, setRetryToken] = useState(0)
  const previousKey = useRef(key)
  useEffect(() => {
    let active = true
    if (previousKey.current !== key) setData(null)
    previousKey.current = key
    setError(null)
    setIsLoading(true)
    void load(key).then(
      value => {
        if (active) {
          setData(value)
          setIsLoading(false)
        }
      },
      () => {
        if (active) {
          setError(message)
          setIsLoading(false)
        }
      }
    )
    return () => {
      active = false
    }
  }, [key, load, message, retryToken])
  return { data, error, isLoading, retry: () => setRetryToken(current => current + 1) }
}
