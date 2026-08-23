import { Directory, File } from 'expo-file-system'

import type { MediaCandidate } from '@/utils/media-indexer'
import { getMediaType, MEDIA_PREVIEW_DIRECTORY } from '@/utils/media-file'

/** Recursively discover attachment files without decoding their contents. */
export function scanForMedia(directoryUri: string): MediaCandidate[] {
  const candidates: MediaCandidate[] = []
  scanDirectory(new Directory(directoryUri), candidates)
  return candidates
}

function scanDirectory(directory: Directory, candidates: MediaCandidate[]): void {
  for (const entry of directory.list()) {
    if (entry instanceof Directory) {
      const directoryName = entry.uri.split('/').filter(Boolean).pop()
      if (directoryName === MEDIA_PREVIEW_DIRECTORY) continue
      scanDirectory(entry, candidates)
      continue
    }
    if (!(entry instanceof File) || /(?:^|_)chat\.txt$/i.test(entry.name)) continue

    const type = getMediaType(entry.name)
    if (!type) continue
    candidates.push({ filename: entry.name, uri: entry.uri, type, size: entry.size })
  }
}

/** Find the transcript, preferring WhatsApp's conventional _chat.txt filename. */
export function findChatFile(directoryUri: string): string | null {
  const directory = new Directory(directoryUri)
  const entries = directory.list()

  for (const entry of entries) {
    if (entry instanceof File && (entry.name === '_chat.txt' || entry.name.endsWith('_chat.txt'))) {
      return entry.uri
    }
  }

  for (const entry of entries) {
    if (entry instanceof File && entry.name.endsWith('.txt')) return entry.uri
  }

  for (const entry of entries) {
    if (entry instanceof Directory) {
      const found = findChatFile(entry.uri)
      if (found) return found
    }
  }

  return null
}
