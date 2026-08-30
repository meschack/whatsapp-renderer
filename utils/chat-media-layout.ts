const MEDIA_MAX_WIDTH = 250
const MEDIA_MAX_HEIGHT = 350
const MEDIA_MIN_HEIGHT = 120
const MEDIA_ASPECT_RATIO = 1.38

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
