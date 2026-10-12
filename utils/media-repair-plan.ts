import type { MediaCandidate } from './media-indexer'

export interface StoredMediaReference {
  id: number
  mediaFilename: string | null
  mediaUri: string | null
}

/** History continuity doesn't prove that reused filenames contain the same bytes. */
export function planMediaRepair(
  rows: StoredMediaReference[],
  candidates: MediaCandidate[],
  uriExists: (uri: string) => boolean
) {
  const sources = new Map<string, Set<string>>()
  for (const row of rows) {
    if (!row.mediaFilename) continue
    const identities = sources.get(row.mediaFilename) ?? new Set<string>()
    identities.add(row.mediaUri ?? `unknown-message-${row.id}`)
    sources.set(row.mediaFilename, identities)
  }
  const conflicting = new Set(
    [...sources].filter(([, identities]) => identities.size > 1).map(([name]) => name)
  )
  const missing = rows.filter(row => !row.mediaUri || !uriExists(row.mediaUri))
  const names = new Set(missing.map(row => row.mediaFilename))
  return {
    missing,
    conflictingNames: [...conflicting],
    candidates: candidates.filter(
      candidate => names.has(candidate.filename) && !conflicting.has(candidate.filename)
    )
  }
}
