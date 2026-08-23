import { describe, expect, it } from 'vitest'

import { getMediaPreviewFilename } from '../utils/media-preview'

describe('media preview cache names', () => {
  it('uses the attachment URI rather than its position in an indexing batch', () => {
    expect(getMediaPreviewFilename('file:///chat/photo.jpg')).toBe(
      getMediaPreviewFilename('file:///chat/photo.jpg')
    )
    expect(getMediaPreviewFilename('file:///chat/photo.jpg')).not.toBe(
      getMediaPreviewFilename('file:///other/photo.jpg')
    )
  })
})
