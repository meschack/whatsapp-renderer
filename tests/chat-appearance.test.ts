import { describe, expect, it } from 'vitest'
import {
  CHAT_WALLPAPER_DIMMING,
  CHAT_TEXT_SCALES,
  CHAT_WALLPAPERS,
  getCustomWallpaperResize,
  getEffectiveChatTextScale,
  getChatTextMetrics,
  normalizeChatAppearance
} from '../utils/chat-appearance'

describe('chat appearance', () => {
  it('accepts bundled choices and falls back safely from stale database values', () => {
    expect(normalizeChatAppearance('forest', 1.15, null, 0.2)).toEqual({
      wallpaper: 'forest',
      textScale: 1.15,
      customWallpaperUri: null,
      wallpaperDimming: 0.2
    })
    expect(normalizeChatAppearance('downloaded-later', 9, 'file:///stale.jpg', 9)).toEqual({
      wallpaper: 'classic',
      textScale: 1,
      customWallpaperUri: null,
      wallpaperDimming: 0
    })
  })

  it('keeps a persisted custom wallpaper only when its local URI is available', () => {
    expect(normalizeChatAppearance('custom', 1, 'file:///wallpaper.jpg', 0.4)).toEqual({
      wallpaper: 'custom',
      textScale: 1,
      customWallpaperUri: 'file:///wallpaper.jpg',
      wallpaperDimming: 0.4
    })
    expect(normalizeChatAppearance('custom', 1, null, 0.4)).toEqual({
      wallpaper: 'classic',
      textScale: 1,
      customWallpaperUri: null,
      wallpaperDimming: 0.4
    })
  })

  it('ships multiple wallpapers and bounded text scales', () => {
    expect(CHAT_WALLPAPERS.length).toBeGreaterThanOrEqual(3)
    expect(CHAT_TEXT_SCALES).toEqual([0.9, 1, 1.15])
    expect(CHAT_WALLPAPER_DIMMING).toEqual([0, 0.2, 0.4])
  })

  it('scales font size and line height together', () => {
    expect(getChatTextMetrics(15, 20, 1.15)).toEqual({ fontSize: 17.25, lineHeight: 23 })
  })

  it('caps custom wallpaper dimensions without upscaling smaller images', () => {
    expect(getCustomWallpaperResize(4032, 3024)).toEqual({ width: 1440 })
    expect(getCustomWallpaperResize(1080, 3200)).toEqual({ height: 2560 })
    expect(getCustomWallpaperResize(4032, 12000)).toEqual({ height: 2560 })
    expect(getCustomWallpaperResize(1080, 1920)).toBeNull()
  })

  it('adds optical compensation for chat typography on iOS only', () => {
    expect(getEffectiveChatTextScale(1, 'ios')).toBe(1.12)
    expect(getEffectiveChatTextScale(1, 'android')).toBe(1)
  })
})
