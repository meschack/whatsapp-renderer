import { describe, expect, it } from 'vitest'

import {
  getChatMediaPreviewSize,
  getChatVideoPreviewSize,
  getChatVisualBubbleWidth
} from '../utils/chat-media-layout'

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

  it('preserves ordinary landscape media and only crops extreme panoramas', () => {
    expect(getChatMediaPreviewSize(393, 1600, 900)).toEqual({
      width: 250,
      height: 140.625
    })
    expect(getChatMediaPreviewSize(393, 2400, 800)).toEqual({
      width: 250,
      height: 120
    })
  })

  it('fits video inside the chat frame without changing its aspect ratio', () => {
    expect(getChatVideoPreviewSize(393, 1080, 1920)).toEqual({
      width: 196.875,
      height: 350
    })
    expect(getChatVideoPreviewSize(393, 1920, 1080)).toEqual({
      width: 250,
      height: 140.625
    })
  })

  it('keeps a captioned visual bubble locked to the media frame instead of stretching', () => {
    expect(getChatVisualBubbleWidth(250)).toBe(258)
    expect(getChatVisualBubbleWidth(196.875)).toBe(204.875)
  })
})
