interface MediaViewerSafeAreaInsets {
  top: number
  bottom: number
}

interface MediaViewerChromePadding {
  headerPaddingTop: number
  footerPaddingBottom: number
}

const HEADER_CONTENT_PADDING = 8
const FOOTER_CONTENT_PADDING = 8
const MIN_HEADER_PADDING = 12
const MIN_FOOTER_PADDING = 16

export function getMediaViewerChromePadding(
  insets: MediaViewerSafeAreaInsets
): MediaViewerChromePadding {
  return {
    headerPaddingTop: Math.max(MIN_HEADER_PADDING, insets.top + HEADER_CONTENT_PADDING),
    footerPaddingBottom: Math.max(MIN_FOOTER_PADDING, insets.bottom + FOOTER_CONTENT_PADDING)
  }
}
