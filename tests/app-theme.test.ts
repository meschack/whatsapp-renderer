import { describe, expect, it } from 'vitest'
import {
  getAdaptiveLayout,
  getAppColors,
  getAppThemeVariables,
  normalizeAppAppearance,
  resolveAppTheme
} from '../utils/app-theme'
import { DEFAULT_CHAT_APPEARANCE, resolveChatTextScale } from '../utils/chat-appearance'

describe('app appearance', () => {
  it('follows system changes only in system mode', () => {
    expect(resolveAppTheme('system', 'light')).toBe('light')
    expect(resolveAppTheme('system', 'dark')).toBe('dark')
    expect(resolveAppTheme('dark', 'light')).toBe('dark')
    expect(resolveAppTheme('light', 'dark')).toBe('light')
    expect(resolveAppTheme('system', null)).toBe('dark')
  })
  it('recovers stale preferences without admitting unsupported text sizes', () => {
    expect(
      normalizeAppAppearance({ mode: 'sepia' as never, defaultTextScale: 7 as never })
    ).toEqual({ mode: 'system', defaultTextScale: 1 })
    expect(normalizeAppAppearance({ mode: 'light', defaultTextScale: 1.15 })).toEqual({
      mode: 'light',
      defaultTextScale: 1.15
    })
  })
  it('changes the semantic bubble, text and background tokens together', () => {
    const light = getAppThemeVariables('light')
    const dark = getAppThemeVariables('dark')
    expect(Object.keys(light)).toEqual(Object.keys(dark))
    expect(light['--app-bg']).not.toBe(dark['--app-bg'])
    expect(light['--app-text-primary']).toBe(getAppColors('light').textPrimary)
    expect(light['--app-bubble-mine']).not.toBe(dark['--app-bubble-mine'])
  })
  it('inherits app reading size without replacing a per-chat choice', () => {
    expect(
      resolveChatTextScale({ ...DEFAULT_CHAT_APPEARANCE, textScaleOverride: null }, 1.15)
    ).toBe(1.15)
    expect(resolveChatTextScale({ ...DEFAULT_CHAT_APPEARANCE, textScaleOverride: 0.9 }, 1.15)).toBe(
      0.9
    )
    // Pre-migration/manual caller values stay explicit.
    expect(resolveChatTextScale({ ...DEFAULT_CHAT_APPEARANCE, textScale: 1 }, 1.15)).toBe(1)
    // Wallpaper-only saves keep inheritance.
    expect(
      resolveChatTextScale(
        { ...DEFAULT_CHAT_APPEARANCE, wallpaper: 'forest', textScaleOverride: null },
        1.15
      )
    ).toBe(1.15)
  })
})
describe('adaptive layout', () => {
  it('keeps phones full width and gives wide landscapes two tool columns', () => {
    expect(getAdaptiveLayout(390, 844, 'reader')).toMatchObject({
      wide: false,
      landscape: false,
      columns: 1,
      contentWidth: 390
    })
    expect(getAdaptiveLayout(844, 390, 'tools')).toMatchObject({
      wide: true,
      landscape: true,
      columns: 2,
      contentWidth: 844
    })
  })
  it('caps tablet columns without introducing horizontal overflow', () => {
    expect(getAdaptiveLayout(1366, 1024, 'reader').contentWidth).toBe(860)
    expect(getAdaptiveLayout(1366, 1024, 'library').contentWidth).toBe(1000)
    expect(getAdaptiveLayout(0, 100).contentWidth).toBe(0)
    expect(getAdaptiveLayout(Number.NaN, 100).contentWidth).toBe(0)
  })
})
