import type { MediaCandidate } from './media-indexer'

/** Build a stable identity from native transcript digest plus normalized media metadata. */
export function createArchiveFingerprint(
  transcriptDigest: string,
  mediaCandidates: MediaCandidate[]
): string {
  const mediaIdentity = mediaCandidates
    .map(candidate => `${candidate.filename}\u0000${candidate.type}\u0000${candidate.size}`)
    .sort()
    .join('\u0001')
  return `v1:${transcriptDigest}:${fnv1a64(mediaIdentity)}`
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(16).padStart(16, '0')
}
