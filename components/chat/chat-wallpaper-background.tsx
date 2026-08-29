import { View } from '@/src/tw'
import { Image } from '@/src/tw/image'
import {
  CHAT_WALLPAPERS,
  getWallpaperDimmingColor,
  type ChatAppearancePreference
} from '@/utils/chat-appearance'

interface ChatWallpaperBackgroundProps {
  preference: ChatAppearancePreference
}

const WHATSAPP_WALLPAPER = require('@/assets/images/whatsapp-dark-wallpaper.png')
const KINSAY_WALLPAPER = require('@/assets/images/wallpaper.jpeg')

export function ChatWallpaperBackground({ preference }: ChatWallpaperBackgroundProps) {
  const preset =
    CHAT_WALLPAPERS.find(option => option.id === preference.wallpaper) ?? CHAT_WALLPAPERS[0]
  const source =
    preset.image === 'whatsapp'
      ? WHATSAPP_WALLPAPER
      : preset.image === 'kinsay'
        ? KINSAY_WALLPAPER
        : preset.image === 'custom' && preference.customWallpaperUri
          ? { uri: preference.customWallpaperUri }
          : null

  return (
    <View
      pointerEvents='none'
      className='absolute inset-0 overflow-hidden'
      style={{ backgroundColor: preset.backgroundColor }}
    >
      {source ? (
        <Image
          source={source}
          className='absolute inset-0 size-full'
          contentFit='cover'
          contentPosition='top center'
          cachePolicy='memory-disk'
          recyclingKey={
            typeof source === 'object' && 'uri' in source ? source.uri : `wallpaper-${preset.id}`
          }
          style={{ opacity: preset.imageOpacity }}
        />
      ) : null}
      {preset.overlayColor !== 'transparent' ? (
        <View className='absolute inset-0' style={{ backgroundColor: preset.overlayColor }} />
      ) : null}
      {preference.wallpaperDimming > 0 ? (
        <View
          className='absolute inset-0'
          style={{ backgroundColor: getWallpaperDimmingColor(preference.wallpaperDimming) }}
        />
      ) : null}
    </View>
  )
}
