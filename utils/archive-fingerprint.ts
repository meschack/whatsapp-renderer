import * as LegacyFileSystem from 'expo-file-system/legacy'

import type { MediaCandidate } from './media-indexer'
import { createArchiveFingerprint } from './archive-identity'

export async function fingerprintArchive(
  transcriptUri: string,
  mediaCandidates: MediaCandidate[]
): Promise<string> {
  const info = await LegacyFileSystem.getInfoAsync(transcriptUri, { md5: true })
  if (!info.exists || !info.md5) {
    throw new Error('Unable to fingerprint the exported chat transcript.')
  }
  return createArchiveFingerprint(info.md5, mediaCandidates)
}
