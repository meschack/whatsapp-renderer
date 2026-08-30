import { describe, expect, it } from 'vitest'

import { getChatMediaPreviewSize } from '../utils/chat-media-layout'

describe('chat media preview layout', () => {
  it('matches WhatsApp-sized portrait media without cropping a 3:4 image', () => {
    expect(getChatMediaPreviewSize(393, 1200, 1600)).toEqual({
      width: 250,
      height: 1000 / 3
    })
  })

  it('caps very tall media at the WhatsApp portrait frame', () => {
    expect(getChatMediaPreviewSize(393, 1080, 1920)).toEqual({
      width: 250,
      height: 350
    })
  })
})
