import { throwIfImportAborted, yieldImportWork } from './import-cancellation'
import { Directory, File } from 'expo-file-system'

import type { MediaCandidate } from '@/utils/media-indexer'
import { getMediaType, MEDIA_PREVIEW_DIRECTORY } from '@/utils/media-file'

/** Recursively discover attachment files without decoding their contents. */
export function scanForMedia(directoryUri: string): MediaCandidate[] {
  const candidates: MediaCandidate[] = []
  scanDirectory(new Directory(directoryUri), candidates, directoryUri)
  return candidates
}

function scanDirectory(directory: Directory, candidates: MediaCandidate[], rootUri: string): void {
  for (const entry of directory.list()) {
    if (entry instanceof Directory) {
      const directoryName = entry.uri.split('/').filter(Boolean).pop()
      if (directoryName === MEDIA_PREVIEW_DIRECTORY) continue
      scanDirectory(entry, candidates, rootUri)
      continue
    }
    if (!(entry instanceof File) || /(?:^|_)chat\.txt$/i.test(entry.name)) continue

    const type = getMediaType(entry.name)
    if (!type) continue
    candidates.push({
      filename: entry.name,
      relativePath: relativePath(entry.uri, rootUri),
      uri: entry.uri,
      type,
      size: entry.size
    })
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

function relativePath(uri: string, root: string): string {
  const path = uri.slice(root.replace(/\/$/, '').length + 1)
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

/** Async discovery yields between directories and file batches so Cancel stays usable. */
export async function discoverChatArchive(
  directoryUri: string,
  signal?: AbortSignal,
  onProgress?: (progress: { completed: number; total: number; filename?: string }) => void
): Promise<{ transcriptUri: string; transcriptName: string; mediaCandidates: MediaCandidate[] }> {
  const mediaCandidates: MediaCandidate[] = []
  const transcripts: Array<{ uri: string; name: string }> = []
  let completed = 0
  const scan = async (directory: Directory): Promise<void> => {
    await yieldImportWork(signal)
    const entries = directory.list()
    for (const entry of entries) {
      throwIfImportAborted(signal)
      if (entry instanceof Directory) {
        if (entry.uri.split('/').filter(Boolean).pop() !== MEDIA_PREVIEW_DIRECTORY)
          await scan(entry)
      } else if (entry instanceof File) {
        if (entry.name.endsWith('.txt')) transcripts.push({ uri: entry.uri, name: entry.name })
        const type = getMediaType(entry.name)
        if (type && !/(?:^|_)chat\.txt$/i.test(entry.name)) {
          mediaCandidates.push({
            filename: entry.name,
            relativePath: relativePath(entry.uri, directoryUri),
            uri: entry.uri,
            type,
            size: entry.size
          })
        }
      }
      completed++
      onProgress?.({ completed, total: 0, filename: entry.uri.split('/').pop() })
      if (completed % 64 === 0) await yieldImportWork(signal)
    }
  }
  await scan(new Directory(directoryUri))
  const transcript =
    transcripts.find(file => /(?:^|_)chat\.txt$/i.test(file.name)) ?? transcripts[0]
  if (!transcript)
    throw new Error('No chat file found in the archive. Make sure this is a WhatsApp export.')
  return { transcriptUri: transcript.uri, transcriptName: transcript.name, mediaCandidates }
}
