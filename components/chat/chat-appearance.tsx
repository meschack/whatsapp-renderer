import { Ionicons } from '@expo/vector-icons'

import { Pressable, Text, View } from '@/src/tw'
import {
  CHAT_TEXT_SCALES,
  CHAT_WALLPAPERS,
  type ChatAppearancePreference,
  type ChatTextScale,
  type ChatWallpaperId
} from '@/utils/chat-appearance'

interface ChatAppearanceProps {
  preference: ChatAppearancePreference
  onChange(preference: ChatAppearancePreference): void
  onReset(): void
  onClose(): void
}

const TEXT_SCALE_LABELS: Record<ChatTextScale, string> = {
  0.9: 'Small',
  1: 'Default',
  1.15: 'Large'
}

export function ChatAppearance({ preference, onChange, onReset, onClose }: ChatAppearanceProps) {
  const selectWallpaper = (wallpaper: ChatWallpaperId) => onChange({ ...preference, wallpaper })
  const selectScale = (textScale: ChatTextScale) => onChange({ ...preference, textScale })

  return (
    <View className='absolute inset-0 z-30 bg-[#0B141A]'>
      <View className='min-h-15 flex-row items-center border-b border-white/5 bg-[#202C33] px-2 py-1'>
        <Pressable
          accessibilityLabel='Close appearance settings'
          accessibilityRole='button'
          className='size-11 items-center justify-center rounded-full active:bg-white/10'
          onPress={onClose}
        >
          <Ionicons name='arrow-back' size={24} color='#E9EDEF' />
        </Pressable>
        <Text className='ml-2 flex-1 text-[17px] font-medium text-[#E9EDEF]'>Appearance</Text>
        <Pressable
          accessibilityLabel='Reset chat appearance'
          accessibilityRole='button'
          className='min-h-11 justify-center rounded-full px-3 active:bg-white/10'
          onPress={onReset}
        >
          <Text className='text-[13px] font-medium text-[#00C896]'>Reset</Text>
        </Pressable>
      </View>

      <View className='px-5 pt-6'>
        <Text className='mb-3 text-[13px] font-medium tracking-wide text-[#8696A0] uppercase'>
          Wallpaper
        </Text>
        <View className='flex-row gap-3'>
          {CHAT_WALLPAPERS.map(wallpaper => {
            const selected = preference.wallpaper === wallpaper.id
            return (
              <Pressable
                key={wallpaper.id}
                accessibilityLabel={`${wallpaper.label} wallpaper`}
                accessibilityRole='radio'
                accessibilityState={{ checked: selected }}
                className='flex-1 items-center'
                onPress={() => selectWallpaper(wallpaper.id)}
              >
                <View
                  className='h-28 w-full overflow-hidden rounded-2xl border-2'
                  style={{
                    backgroundColor: wallpaper.backgroundColor,
                    borderColor: selected ? '#00A884' : '#2A3942'
                  }}
                >
                  <View
                    className='absolute inset-0'
                    style={{ backgroundColor: wallpaper.overlayColor }}
                  />
                  <View className='absolute top-5 left-3 h-5 w-[65%] rounded-lg bg-[#202C2C]' />
                  <View className='absolute top-12 right-3 h-7 w-[72%] rounded-lg bg-[#075E48]' />
                  {selected ? (
                    <View className='absolute right-2 bottom-2 size-6 items-center justify-center rounded-full bg-[#00A884]'>
                      <Ionicons name='checkmark' size={16} color='#071A16' />
                    </View>
                  ) : null}
                </View>
                <Text className='mt-2 text-[12px] text-[#D1D7DB]'>{wallpaper.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <Text className='mt-8 mb-3 text-[13px] font-medium tracking-wide text-[#8696A0] uppercase'>
          Message text
        </Text>
        <View className='overflow-hidden rounded-2xl bg-[#202C33]'>
          {CHAT_TEXT_SCALES.map(textScale => {
            const selected = preference.textScale === textScale
            return (
              <Pressable
                key={textScale}
                accessibilityLabel={`${TEXT_SCALE_LABELS[textScale]} message text`}
                accessibilityRole='radio'
                accessibilityState={{ checked: selected }}
                className='min-h-14 flex-row items-center border-b border-white/5 px-4 last:border-b-0 active:bg-white/5'
                onPress={() => selectScale(textScale)}
              >
                <Text
                  className='flex-1 text-[#E9EDEF]'
                  style={{ fontSize: 15 * textScale, lineHeight: 20 * textScale }}
                >
                  {TEXT_SCALE_LABELS[textScale]}
                </Text>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={selected ? '#00A884' : '#667781'}
                />
              </Pressable>
            )
          })}
        </View>

        <View className='mt-6 rounded-2xl bg-[#202C33] p-4'>
          <Text
            className='text-[#E9EDEF]'
            style={{
              fontSize: 15 * preference.textScale,
              lineHeight: 20 * preference.textScale
            }}
          >
            This is how messages will look in this chat.
          </Text>
          <Text className='mt-2 text-[11px] text-[#8696A0]'>
            Changes stay on this device and do not modify the imported transcript.
          </Text>
        </View>
      </View>
    </View>
  )
}
