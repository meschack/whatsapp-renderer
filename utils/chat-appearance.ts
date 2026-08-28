export const CHAT_TEXT_SCALES = [0.9, 1, 1.15] as const
export type ChatTextScale = (typeof CHAT_TEXT_SCALES)[number]

const IOS_CHAT_TEXT_SCALE = 1.12

export function getEffectiveChatTextScale(scale: ChatTextScale, platform: string): number {
  return platform === 'ios' ? Number((scale * IOS_CHAT_TEXT_SCALE).toFixed(3)) : scale
}

export const CHAT_WALLPAPERS = [
  {
    id: 'classic',
    label: 'Classic',
    backgroundColor: '#0B141A',
    imageOpacity: 1,
    overlayColor: 'transparent'
  },
  {
    id: 'midnight',
    label: 'Midnight',
    backgroundColor: '#071016',
    imageOpacity: 0.16,
    overlayColor: 'rgba(3, 11, 16, 0.58)'
  },
  {
    id: 'forest',
    label: 'Forest',
    backgroundColor: '#071B17',
    imageOpacity: 0.22,
    overlayColor: 'rgba(3, 33, 26, 0.52)'
  }
] as const

export type ChatWallpaperId = (typeof CHAT_WALLPAPERS)[number]['id']

export interface ChatAppearancePreference {
  wallpaper: ChatWallpaperId
  textScale: ChatTextScale
}

export const DEFAULT_CHAT_APPEARANCE: ChatAppearancePreference = {
  wallpaper: 'classic',
  textScale: 1
}

export function normalizeChatAppearance(
  wallpaper: string | null | undefined,
  textScale: number | null | undefined
): ChatAppearancePreference {
  const selectedWallpaper = CHAT_WALLPAPERS.find(option => option.id === wallpaper)
  const selectedScale = CHAT_TEXT_SCALES.find(option => option === textScale)
  return {
    wallpaper: selectedWallpaper?.id ?? DEFAULT_CHAT_APPEARANCE.wallpaper,
    textScale: selectedScale ?? DEFAULT_CHAT_APPEARANCE.textScale
  }
}

export function getChatTextMetrics(
  baseFontSize: number,
  baseLineHeight: number,
  scale: number
): { fontSize: number; lineHeight: number } {
  return {
    fontSize: baseFontSize * scale,
    lineHeight: Math.round(baseLineHeight * scale)
  }
}
