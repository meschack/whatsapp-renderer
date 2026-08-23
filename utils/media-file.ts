import type { MediaType } from '../models/types'
import type { AttachmentRecord } from './media-library'

export const MEDIA_PREVIEW_DIRECTORY = '.wr-previews'

const MEDIA_TYPES: Record<string, MediaType> = {
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  mp4: 'video',
  mkv: 'video',
  avi: 'video',
  mov: 'video',
  '3gp': 'video',
  opus: 'audio',
  mp3: 'audio',
  m4a: 'audio',
  ogg: 'audio',
  aac: 'audio',
  pdf: 'document',
  doc: 'document',
  docx: 'document',
  xls: 'document',
  xlsx: 'document',
  ppt: 'document',
  pptx: 'document',
  txt: 'document',
  zip: 'document',
  vcf: 'document'
}

export function getMediaType(filename: string): MediaType | null {
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  return MEDIA_TYPES[extension] ?? null
}

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  '3gp': 'video/3gpp'
}

export function getSafeMediaFilename(record: AttachmentRecord): string {
  const fallbackExtension = record.type === 'video' ? 'mp4' : 'jpg'
  const fallback = `whatsapp-${record.sequence}.${fallbackExtension}`
  const decoded = decodeFilename(record.filename)
  if (!decoded) return fallback
  const safe = decoded.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim()
  return safe && safe !== '.' && safe !== '..' ? safe : fallback
}

export function getMediaMimeType(record: AttachmentRecord): string {
  const filename = getSafeMediaFilename(record)
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME_TYPES[extension] ?? (record.type === 'video' ? 'video/*' : 'image/*')
}

export function getAdjacentMediaSequence(
  records: AttachmentRecord[],
  currentSequence: number,
  direction: 'newer' | 'older'
): number | null {
  const index = records.findIndex(record => record.sequence === currentSequence)
  if (index < 0) return null
  return records[index + (direction === 'newer' ? -1 : 1)]?.sequence ?? null
}

function decodeFilename(filename: string | null): string | null {
  if (!filename) return null
  try {
    return decodeURIComponent(filename)
  } catch {
    return filename
  }
}
