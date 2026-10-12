const active = new Map<AbortController, Promise<void>>()
let resetting = false

/** Register before starting asynchronous work that can write into the archive. */
export function beginArchiveOperation(controller: AbortController): () => void {
  if (resetting) throw new Error('The archive is being reset. Please wait.')
  let finish!: () => void
  const settled = new Promise<void>(resolve => {
    finish = resolve
  })
  active.set(controller, settled)
  return () => {
    active.delete(controller)
    finish()
  }
}

export async function withArchiveWrite<T>(write: () => Promise<T>): Promise<T> {
  const finish = beginArchiveOperation(new AbortController())
  try {
    return await write()
  } finally {
    finish()
  }
}

/** Freeze new writers, cancel and drain old ones, then run destructive recovery. */
export async function resetAfterArchiveOperations(reset: () => Promise<void>): Promise<void> {
  if (resetting) throw new Error('The archive is already being reset.')
  resetting = true
  try {
    const operations = [...active.entries()]
    for (const [controller] of operations) controller.abort()
    await Promise.all(operations.map(([, settled]) => settled))
    await reset()
  } finally {
    resetting = false
  }
}
