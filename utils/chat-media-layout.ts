const MEDIA_MAX_WIDTH = 250
const MEDIA_MAX_HEIGHT = 350
const MEDIA_MIN_HEIGHT = 120
const MEDIA_ASPECT_RATIO = 1.38
const VISUAL_BUBBLE_HORIZONTAL_PADDING = 8

export interface ChatMediaPreviewSize {
  width: number
  height: number
}

export function getChatMediaPreviewSize(
  screenWidth: number,
  mediaWidth: number | null,
  mediaHeight: number | null
): ChatMediaPreviewSize {
  const width = Math.min(MEDIA_MAX_WIDTH, screenWidth * 0.78)
  const height =
    mediaWidth && mediaHeight
      ? Math.min(MEDIA_MAX_HEIGHT, Math.max(MEDIA_MIN_HEIGHT, width * (mediaHeight / mediaWidth)))
      : width / MEDIA_ASPECT_RATIO

  return { width, height }
}

export function getChatVideoPreviewSize(
  screenWidth: number,
  mediaWidth: number | null,
  mediaHeight: number | null
): ChatMediaPreviewSize {
  const maxWidth = Math.min(MEDIA_MAX_WIDTH, screenWidth * 0.78)
  if (!mediaWidth || !mediaHeight) {
    return { width: maxWidth, height: maxWidth / MEDIA_ASPECT_RATIO }
  }

  const aspectRatio = mediaWidth / mediaHeight
  const width = Math.min(maxWidth, MEDIA_MAX_HEIGHT * aspectRatio)
  return { width, height: width / aspectRatio }
}

export function getChatVisualBubbleWidth(previewWidth: number): number {
  return previewWidth + VISUAL_BUBBLE_HORIZONTAL_PADDING
}

export function isStickerMediaUri(uri: string): boolean {
  const encodedFilename = uri.split('/').pop()?.split(/[?#]/)[0] ?? ''
  let filename = encodedFilename

  try {
    filename = decodeURIComponent(encodedFilename)
  } catch {
    // A malformed URI should still render as an ordinary image, not crash the chat.
  }

  return /^(?:STK-|STICKER)/i.test(filename) && filename.toLowerCase().endsWith('.webp')
}
