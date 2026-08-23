export interface ThrottledWriter<T> {
  schedule(value: T): void
  flush(): void
  cancel(): void
}

/**
 * Write immediately on first use, then coalesce rapid updates into one trailing write.
 * The small injectable clock surface keeps this utility deterministic in tests.
 */
export function createThrottledWriter<T>(
  write: (value: T) => void,
  intervalMs: number,
  now: () => number = Date.now
): ThrottledWriter<T> {
  let lastWrittenAt: number | null = null
  let pendingValue: T | undefined
  let hasPendingValue = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  const commit = () => {
    clearTimer()
    if (!hasPendingValue) return

    const value = pendingValue as T
    pendingValue = undefined
    hasPendingValue = false
    lastWrittenAt = now()
    write(value)
  }

  return {
    schedule(value) {
      pendingValue = value
      hasPendingValue = true

      if (lastWrittenAt === null || now() - lastWrittenAt >= intervalMs) {
        commit()
        return
      }

      if (timer === null) {
        timer = setTimeout(commit, intervalMs - (now() - lastWrittenAt))
      }
    },
    flush: commit,
    cancel() {
      clearTimer()
      pendingValue = undefined
      hasPendingValue = false
    }
  }
}
