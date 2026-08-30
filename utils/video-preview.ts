export interface DeferredVideoPreview<T> {
  isReady(): boolean
  subscribe(onReady: () => void, onError: (error: Error) => void): () => void
  generate(): Promise<T>
}

interface VideoPreviewLoadOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

function abortError(): Error {
  const error = new Error('Video preview generation cancelled')
  error.name = 'AbortError'
  return error
}

export async function loadVideoPreviewFrame<T>(
  preview: DeferredVideoPreview<T>,
  { signal, timeoutMs = 4_000 }: VideoPreviewLoadOptions = {}
): Promise<T> {
  if (signal?.aborted) throw abortError()

  if (!preview.isReady()) {
    await new Promise<void>((resolve, reject) => {
      let settled = false
      let unsubscribe: (() => void) | null = null

      const cleanup = () => {
        clearTimeout(timeout)
        signal?.removeEventListener('abort', onAbort)
        unsubscribe?.()
      }
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        cleanup()
        if (error) reject(error)
        else resolve()
      }
      const onAbort = () => finish(abortError())
      const timeout = setTimeout(
        () => finish(new Error('Timed out while loading video metadata.')),
        timeoutMs
      )

      signal?.addEventListener('abort', onAbort, { once: true })
      unsubscribe = preview.subscribe(
        () => finish(),
        error => finish(error)
      )
      if (settled) unsubscribe()
      else if (preview.isReady()) finish()
    })
  }

  if (signal?.aborted) throw abortError()
  return preview.generate()
}
