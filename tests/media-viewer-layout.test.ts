import { describe, expect, it } from 'vitest'

import { getMediaViewerChromePadding } from '../utils/media-viewer-layout'

describe('media viewer chrome layout', () => {
  it('places controls below the status bar and above the home indicator', () => {
    expect(getMediaViewerChromePadding({ top: 47, bottom: 34 })).toEqual({
      headerPaddingTop: 55,
      footerPaddingBottom: 42
    })
  })

  it('retains comfortable padding when a device reports no safe-area inset', () => {
    expect(getMediaViewerChromePadding({ top: 0, bottom: 0 })).toEqual({
      headerPaddingTop: 12,
      footerPaddingBottom: 16
    })
  })
})
