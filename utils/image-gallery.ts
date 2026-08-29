import type { Message } from '../models/types'

export type ImageGridLayout = 'pair' | 'trio' | 'quad'

export function getImageGridPresentation(count: number): {
  tileCount: number
  hiddenCount: number
  layout: ImageGridLayout
} {
  const safeCount = Math.max(2, Math.floor(count))
  const tileCount = Math.min(4, safeCount)
  return {
    tileCount,
    hiddenCount: Math.max(0, safeCount - tileCount),
    layout: tileCount === 2 ? 'pair' : tileCount === 3 ? 'trio' : 'quad'
  }
}

export function isGalleryImageMessage(message: Message): boolean {
  if (message.mediaType !== 'image' || !message.mediaUri) return false
  if (message.text?.trim()) return false
  return !isStickerFilename(message.mediaFilename ?? message.mediaUri)
}

export function canJoinImageGroup(previous: Message, next: Message, maxGapMs = 120_000): boolean {
  if (!isGalleryImageMessage(previous) || !isGalleryImageMessage(next)) return false
  if (previous.sender !== next.sender || previous.isMine !== next.isMine) return false
  const gap = next.timestamp.getTime() - previous.timestamp.getTime()
  return gap >= 0 && gap <= maxGapMs
}

export function isStickerFilename(value: string): boolean {
  const encodedFilename = value.split('/').pop()?.split(/[?#]/)[0] ?? ''
  let filename = encodedFilename
  try {
    filename = decodeURIComponent(encodedFilename)
  } catch {
    // Malformed URI components are ordinary images unless the raw filename says otherwise.
  }
  return /^(?:STK-|STICKER)/i.test(filename) && filename.toLowerCase().endsWith('.webp')
}
