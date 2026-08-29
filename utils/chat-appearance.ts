export const CHAT_TEXT_SCALES = [0.9, 1, 1.15] as const
export type ChatTextScale = (typeof CHAT_TEXT_SCALES)[number]

export const CHAT_WALLPAPER_DIMMING = [0, 0.2, 0.4] as const
export type ChatWallpaperDimming = (typeof CHAT_WALLPAPER_DIMMING)[number]

export const CHAT_WALLPAPERS = [
  {
    id: 'classic',
    label: 'Default',
    image: 'whatsapp',
    backgroundColor: '#0B141A',
    imageOpacity: 1,
    overlayColor: 'transparent'
  },
  {
    id: 'kinsay',
    label: 'Kinsay',
    image: 'kinsay',
    backgroundColor: '#050607',
    imageOpacity: 0.88,
    overlayColor: 'rgba(0, 0, 0, 0.08)'
  },
  {
    id: 'midnight',
    label: 'Ink',
    image: null,
    backgroundColor: '#05090D',
    imageOpacity: 0,
    overlayColor: 'transparent'
  },
  {
    id: 'forest',
    label: 'Moss',
    image: null,
    backgroundColor: '#071B17',
    imageOpacity: 0,
    overlayColor: 'transparent'
  },
  {
    id: 'custom',
    label: 'Photo',
    image: 'custom',
    backgroundColor: '#11181D',
    imageOpacity: 1,
    overlayColor: 'transparent'
  }
] as const

export type ChatWallpaperId = (typeof CHAT_WALLPAPERS)[number]['id']

export interface ChatAppearancePreference {
  wallpaper: ChatWallpaperId
  textScale: ChatTextScale
  customWallpaperUri: string | null
  wallpaperDimming: ChatWallpaperDimming
}

export const DEFAULT_CHAT_APPEARANCE: ChatAppearancePreference = {
  wallpaper: 'classic',
  textScale: 1,
  customWallpaperUri: null,
  wallpaperDimming: 0
}

export function normalizeChatAppearance(
  wallpaper: string | null | undefined,
  textScale: number | null | undefined,
  customWallpaperUri: string | null | undefined = null,
  wallpaperDimming: number | null | undefined = 0
): ChatAppearancePreference {
  const selectedWallpaper = CHAT_WALLPAPERS.find(option => option.id === wallpaper)
  const selectedScale = CHAT_TEXT_SCALES.find(option => option === textScale)
  const selectedDimming = CHAT_WALLPAPER_DIMMING.find(option => option === wallpaperDimming)
  const normalizedCustomUri = customWallpaperUri?.trim() || null
  const resolvedWallpaper =
    selectedWallpaper?.id === 'custom' && !normalizedCustomUri
      ? DEFAULT_CHAT_APPEARANCE.wallpaper
      : (selectedWallpaper?.id ?? DEFAULT_CHAT_APPEARANCE.wallpaper)

  return {
    wallpaper: resolvedWallpaper,
    textScale: selectedScale ?? DEFAULT_CHAT_APPEARANCE.textScale,
    customWallpaperUri: selectedWallpaper ? normalizedCustomUri : null,
    wallpaperDimming: selectedDimming ?? DEFAULT_CHAT_APPEARANCE.wallpaperDimming
  }
}

export function getWallpaperDimmingColor(dimming: ChatWallpaperDimming): string {
  return dimming === 0 ? 'transparent' : `rgba(0, 0, 0, ${dimming})`
}

export function getCustomWallpaperResize(
  width: number,
  height: number
): { width: number } | { height: number } | null {
  const widthScale = width > 0 ? 1440 / width : 1
  const heightScale = height > 0 ? 2560 / height : 1
  const scale = Math.min(widthScale, heightScale, 1)
  if (scale === 1) return null
  return widthScale <= heightScale ? { width: 1440 } : { height: 2560 }
}

export function getChatTextMetrics(
  baseFontSize: number,
  baseLineHeight: number,
  scale: ChatTextScale
): { fontSize: number; lineHeight: number } {
  return {
    fontSize: baseFontSize * scale,
    lineHeight: Math.round(baseLineHeight * scale)
  }
}
