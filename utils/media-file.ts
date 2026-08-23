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
  '3gp': 'video/3gpp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  zip: 'application/zip',
  vcf: 'text/vcard'
}

const DOCUMENT_LABELS: Record<string, string> = {
  pdf: 'PDF',
  doc: 'Word',
  docx: 'Word',
  xls: 'Excel',
  xlsx: 'Excel',
  ppt: 'PowerPoint',
  pptx: 'PowerPoint',
  txt: 'Text',
  zip: 'ZIP archive',
  vcf: 'Contact card'
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
  return (
    MIME_TYPES[extension] ??
    (record.type === 'video'
      ? 'video/*'
      : record.type === 'image'
        ? 'image/*'
        : 'application/octet-stream')
  )
}

export function getDecodedFilename(filename: string | null, fallback: string): string {
  return decodeFilename(filename) ?? fallback
}

export function getDocumentPresentation(filename: string): {
  label: string
  mimeType: string
} | null {
  const extension = filename.split('.').pop()?.toLowerCase() ?? ''
  const label = DOCUMENT_LABELS[extension]
  const mimeType = MIME_TYPES[extension]
  return label && mimeType ? { label, mimeType } : null
}

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return 'Unknown size'
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`
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
