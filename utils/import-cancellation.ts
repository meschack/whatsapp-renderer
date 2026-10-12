export function throwIfImportAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  const error = new Error('Import cancelled')
  error.name = 'AbortError'
  throw error
}

/** Give UI cancellation events a chance to run during CPU-heavy passes. */
export async function yieldImportWork(signal?: AbortSignal): Promise<void> {
  throwIfImportAborted(signal)
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  throwIfImportAborted(signal)
}
