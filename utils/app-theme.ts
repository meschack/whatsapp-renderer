import { DARK_COLORS, LIGHT_COLORS } from '../constants/theme'
import { CHAT_TEXT_SCALES, type ChatTextScale } from './chat-appearance'

export const APP_THEME_MODES = ['system', 'light', 'dark'] as const
export type AppThemeMode = (typeof APP_THEME_MODES)[number]
export interface AppAppearanceSettings {
  mode: AppThemeMode
  defaultTextScale: ChatTextScale
}
export const DEFAULT_APP_APPEARANCE: AppAppearanceSettings = { mode: 'system', defaultTextScale: 1 }

export function normalizeAppAppearance(
  value: Partial<AppAppearanceSettings> | null
): AppAppearanceSettings {
  return {
    mode: APP_THEME_MODES.includes(value?.mode as AppThemeMode) ? value!.mode! : 'system',
    defaultTextScale: CHAT_TEXT_SCALES.includes(value?.defaultTextScale as ChatTextScale)
      ? value!.defaultTextScale!
      : 1
  }
}
export function resolveAppTheme(
  mode: AppThemeMode,
  system: string | null | undefined
): 'light' | 'dark' {
  return mode === 'system' ? (system === 'light' ? 'light' : 'dark') : mode
}
export function getAppColors(theme: 'light' | 'dark') {
  return theme === 'light' ? LIGHT_COLORS : DARK_COLORS
}
export function getAppThemeVariables(theme: 'light' | 'dark'): Record<`--${string}`, string> {
  const colors = getAppColors(theme)
  return {
    '--app-bg': colors.background,
    '--app-header': colors.headerBackground,
    '--app-input': colors.inputBackground,
    '--app-bubble-mine': colors.bubbleMine,
    '--app-bubble-other': colors.bubbleOther,
    '--app-text-primary': colors.textPrimary,
    '--app-text-secondary': colors.textSecondary,
    '--app-text-sender': colors.textSender,
    '--app-text-timestamp': colors.textTimestamp,
    '--app-text-timestamp-mine': colors.textTimestampMine,
    '--app-accent': colors.accent,
    '--app-on-accent': colors.onAccent,
    '--app-accent-light': colors.accentLight,
    '--app-icon': colors.iconColor,
    '--app-divider': colors.divider,
    '--app-checkmark': colors.checkmark,
    '--app-waveform': colors.audioWaveform,
    '--app-waveform-active': colors.audioWaveformActive,
    '--app-error': colors.error
  }
}

/** Keep a readable centered column; compact landscapes gain two-column tool grids. */
export function getAdaptiveLayout(
  width: number,
  height: number,
  surface: 'library' | 'reader' | 'tools' = 'reader'
) {
  const availableWidth = Math.max(0, Number.isFinite(width) ? width : 0)
  const wide = availableWidth >= 700
  const maxWidth = surface === 'library' ? 1000 : surface === 'tools' ? 960 : 860
  return {
    wide,
    landscape: availableWidth > height,
    columns: wide ? 2 : 1,
    horizontalPadding: wide ? 24 : 12,
    contentWidth: Math.min(availableWidth, maxWidth),
    containerStyle: { width: '100%' as const, maxWidth, alignSelf: 'center' as const }
  }
}
