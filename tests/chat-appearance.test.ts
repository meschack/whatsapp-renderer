import { describe, expect, it } from 'vitest'
import {
  CHAT_TEXT_SCALES,
  CHAT_WALLPAPERS,
  getChatTextMetrics,
  normalizeChatAppearance
} from '../utils/chat-appearance'

describe('chat appearance', () => {
  it('accepts bundled choices and falls back safely from stale database values', () => {
    expect(normalizeChatAppearance('forest', 1.15)).toEqual({
      wallpaper: 'forest',
      textScale: 1.15
    })
    expect(normalizeChatAppearance('downloaded-later', 9)).toEqual({
      wallpaper: 'classic',
      textScale: 1
    })
  })

  it('ships multiple wallpapers and bounded text scales', () => {
    expect(CHAT_WALLPAPERS.length).toBeGreaterThanOrEqual(3)
    expect(CHAT_TEXT_SCALES).toEqual([0.9, 1, 1.15])
  })

  it('scales font size and line height together', () => {
    expect(getChatTextMetrics(15, 20, 1.15)).toEqual({ fontSize: 17.25, lineHeight: 23 })
  })
})
