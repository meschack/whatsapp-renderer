import type { MediaCandidate } from './media-indexer'

export interface AmbiguousMediaBasename {
  filename: string
  relativePaths: string[]
}

export function findAmbiguousMedia(candidates: MediaCandidate[]): AmbiguousMediaBasename[] {
  const groups = new Map<string, MediaCandidate[]>()
  for (const candidate of candidates) {
    const group = groups.get(candidate.filename) ?? []
    group.push(candidate)
    groups.set(candidate.filename, group)
  }
  return [...groups]
    .filter(([, group]) => group.length > 1)
    .map(([filename, group]) => ({
      filename,
      relativePaths: group.map(candidate => candidate.relativePath ?? candidate.uri).sort()
    }))
}

/** Basename references cannot safely select one of multiple archive paths. */
export function unambiguousMediaCandidates(candidates: MediaCandidate[]): MediaCandidate[] {
  const ambiguous = new Set(findAmbiguousMedia(candidates).map(group => group.filename))
  return candidates.filter(candidate => !ambiguous.has(candidate.filename))
}
