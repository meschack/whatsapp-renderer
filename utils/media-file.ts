import type { MediaType } from '../models/types'

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
