import type { MediaMap } from '@/models/types'
import { Directory, File } from 'expo-file-system'

const MEDIA_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'mp4',
  'mkv',
  'avi',
  'mov',
  '3gp',
  'opus',
  'mp3',
  'm4a',
  'ogg',
  'aac',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'vcf'
])

/**
 * Recursively scan a directory and build a map of filename → file URI
 * for all media files found.
 */
export function scanForMedia(directoryUri: string): MediaMap {
  const mediaMap: MediaMap = new Map()
  scanDirectory(new Directory(directoryUri), mediaMap)
  return mediaMap
}

function scanDirectory(dir: Directory, mediaMap: MediaMap): void {
  const entries = dir.list()

  for (const entry of entries) {
    if (entry instanceof Directory) {
      scanDirectory(entry, mediaMap)
    } else if (entry instanceof File) {
      const ext = entry.extension?.replace('.', '').toLowerCase() ?? ''
      if (MEDIA_EXTENSIONS.has(ext)) {
        mediaMap.set(entry.name, entry.uri)
      }
    }
  }
}

/**
 * Find the chat text file in the extracted directory.
 * WhatsApp exports it as _chat.txt or similar.
 */
export function findChatFile(directoryUri: string): string | null {
  const dir = new Directory(directoryUri)
  const entries = dir.list()

  // Look for _chat.txt first
  for (const entry of entries) {
    if (entry instanceof File && (entry.name === '_chat.txt' || entry.name.endsWith('_chat.txt'))) {
      return entry.uri
    }
  }

  // Fallback: look for any .txt file
  for (const entry of entries) {
    if (entry instanceof File && entry.name.endsWith('.txt')) {
      return entry.uri
    }
  }

  // Check subdirectories
  for (const entry of entries) {
    if (entry instanceof Directory) {
      const found = findChatFile(entry.uri)
      if (found) return found
    }
  }

  return null
}
