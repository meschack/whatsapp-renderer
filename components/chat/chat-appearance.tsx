import { Ionicons } from '@expo/vector-icons'

import { ChatWallpaperBackground } from './chat-wallpaper-background'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from '@/src/tw'
import {
  CHAT_TEXT_SCALES,
  CHAT_WALLPAPER_DIMMING,
  CHAT_WALLPAPERS,
  type ChatAppearancePreference,
  type ChatTextScale,
  type ChatWallpaperDimming,
  type ChatWallpaperId
} from '@/utils/chat-appearance'

interface ChatAppearanceProps {
  preference: ChatAppearancePreference
  isChoosingWallpaper: boolean
  onChange(preference: ChatAppearancePreference): void
  onChooseCustomWallpaper(): void
  onReset(): void
  onClose(): void
}

const TEXT_SCALE_LABELS: Record<ChatTextScale, string> = {
  0.9: 'Small',
  1: 'Default',
  1.15: 'Large'
}

const DIMMING_LABELS: Record<ChatWallpaperDimming, string> = {
  0: 'Bright',
  0.2: 'Dim',
  0.4: 'Dark'
}

export function ChatAppearance({
  preference,
  isChoosingWallpaper,
  onChange,
  onChooseCustomWallpaper,
  onReset,
  onClose
}: ChatAppearanceProps) {
  const selectWallpaper = (wallpaper: ChatWallpaperId) => onChange({ ...preference, wallpaper })
  const selectScale = (textScale: ChatTextScale) => onChange({ ...preference, textScale })
  const selectDimming = (wallpaperDimming: ChatWallpaperDimming) =>
    onChange({ ...preference, wallpaperDimming })

  return (
    <View className='absolute inset-0 z-30 bg-[#0B141A]'>
      <View className='min-h-15 flex-row items-center border-b border-white/5 bg-[#111B21] px-2 py-1'>
        <Pressable
          accessibilityLabel='Close appearance settings'
          accessibilityRole='button'
          className='size-11 items-center justify-center rounded-full active:bg-white/10'
          onPress={onClose}
        >
          <Ionicons name='arrow-back' size={24} color='#E9EDEF' />
        </Pressable>
        <Text className='ml-2 flex-1 text-[18px] font-medium text-[#E9EDEF]'>Chat appearance</Text>
        <Pressable
          accessibilityLabel='Reset chat appearance'
          accessibilityRole='button'
          className='min-h-11 justify-center rounded-full px-3 active:bg-white/10'
          onPress={onReset}
        >
          <Text className='text-[14px] font-medium text-[#00A884]'>Reset</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName='px-4 pt-4 pb-10'>
        <View className='h-52 overflow-hidden rounded-2xl border border-white/10 bg-black'>
          <ChatWallpaperBackground preference={preference} />
          <View className='absolute top-3 self-center rounded-lg bg-[#182229]/95 px-3 py-1'>
            <Text className='text-[11px] font-medium text-[#E9EDEF]'>Today</Text>
          </View>
          <View className='absolute top-14 left-3 max-w-[76%] rounded-xl rounded-tl-sm bg-[#202C33] px-3 py-2'>
            <Text
              className='text-[#E9EDEF]'
              style={{ fontSize: 14 * preference.textScale, lineHeight: 19 * preference.textScale }}
            >
              This is how the chat will look.
            </Text>
            <Text className='mt-0.5 self-end text-[10px] text-[#8696A0]'>10:14 AM</Text>
          </View>
          <View className='absolute right-3 bottom-4 max-w-[78%] rounded-xl rounded-tr-sm bg-[#005C4B] px-3 py-2'>
            <Text
              className='text-[#E9EDEF]'
              style={{ fontSize: 14 * preference.textScale, lineHeight: 19 * preference.textScale }}
            >
              Personalize it until it feels right.
            </Text>
            <View className='mt-0.5 flex-row items-center justify-end'>
              <Text className='text-[10px] text-[#A7C5BD]'>10:15 AM</Text>
              <Ionicons name='checkmark-done' size={14} color='#53BDEB' />
            </View>
          </View>
        </View>

        <Text className='mt-7 mb-3 text-[13px] font-medium tracking-wide text-[#8696A0] uppercase'>
          Wallpaper
        </Text>
        <View className='flex-row flex-wrap gap-3'>
          {CHAT_WALLPAPERS.map(wallpaper => {
            const selected = preference.wallpaper === wallpaper.id
            const isEmptyCustom = wallpaper.id === 'custom' && !preference.customWallpaperUri
            const previewPreference = { ...preference, wallpaper: wallpaper.id }

            return (
              <Pressable
                key={wallpaper.id}
                accessibilityLabel={`${wallpaper.label} wallpaper`}
                accessibilityRole='radio'
                accessibilityState={{ checked: selected }}
                className='items-center'
                disabled={isChoosingWallpaper && wallpaper.id === 'custom'}
                onPress={() => {
                  if (isEmptyCustom) onChooseCustomWallpaper()
                  else selectWallpaper(wallpaper.id)
                }}
                style={{ width: '30.5%' }}
              >
                <View
                  className='h-28 w-full overflow-hidden rounded-xl border-2'
                  style={{ borderColor: selected ? '#00A884' : '#2A3942' }}
                >
                  <ChatWallpaperBackground preference={previewPreference} />
                  <View className='absolute top-4 left-2 h-4 w-[67%] rounded-md bg-[#202C33]' />
                  <View className='absolute top-10 right-2 h-6 w-[74%] rounded-md bg-[#005C4B]' />
                  {wallpaper.id === 'custom' ? (
                    <View className='absolute inset-0 items-center justify-center bg-black/20'>
                      {isChoosingWallpaper ? (
                        <ActivityIndicator size='small' color='#FFFFFF' />
                      ) : (
                        <View className='size-9 items-center justify-center rounded-full bg-black/55'>
                          <Ionicons
                            name={isEmptyCustom ? 'image-outline' : 'pencil'}
                            size={18}
                            color='#FFFFFF'
                          />
                        </View>
                      )}
                    </View>
                  ) : null}
                  {selected ? (
                    <View className='absolute right-2 bottom-2 size-6 items-center justify-center rounded-full bg-[#00A884]'>
                      <Ionicons name='checkmark' size={16} color='#071A16' />
                    </View>
                  ) : null}
                </View>
                <Text className='mt-1.5 text-[12px] text-[#D1D7DB]'>{wallpaper.label}</Text>
              </Pressable>
            )
          })}
        </View>

        <Pressable
          accessibilityLabel={
            preference.customWallpaperUri ? 'Choose another photo' : 'Choose photo'
          }
          accessibilityRole='button'
          className='mt-4 min-h-12 flex-row items-center justify-center rounded-xl bg-[#202C33] active:bg-[#26343C]'
          disabled={isChoosingWallpaper}
          onPress={onChooseCustomWallpaper}
        >
          {isChoosingWallpaper ? (
            <ActivityIndicator size='small' color='#00A884' />
          ) : (
            <Ionicons name='images-outline' size={20} color='#00A884' />
          )}
          <Text className='ml-2 text-[14px] font-medium text-[#E9EDEF]'>
            {preference.customWallpaperUri ? 'Choose another photo' : 'Choose a photo'}
          </Text>
        </Pressable>

        <Text className='mt-7 mb-3 text-[13px] font-medium tracking-wide text-[#8696A0] uppercase'>
          Wallpaper brightness
        </Text>
        <View className='flex-row rounded-xl bg-[#202C33] p-1'>
          {CHAT_WALLPAPER_DIMMING.map(dimming => {
            const selected = preference.wallpaperDimming === dimming
            return (
              <Pressable
                key={dimming}
                accessibilityLabel={`${DIMMING_LABELS[dimming]} wallpaper`}
                accessibilityRole='radio'
                accessibilityState={{ checked: selected }}
                className='min-h-10 flex-1 items-center justify-center rounded-lg'
                onPress={() => selectDimming(dimming)}
                style={{ backgroundColor: selected ? '#005C4B' : 'transparent' }}
              >
                <Text className='text-[13px] font-medium text-[#E9EDEF]'>
                  {DIMMING_LABELS[dimming]}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <Text className='mt-7 mb-3 text-[13px] font-medium tracking-wide text-[#8696A0] uppercase'>
          Message text
        </Text>
        <View className='overflow-hidden rounded-xl bg-[#202C33]'>
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

        <Text className='mt-4 text-center text-[11px] leading-4 text-[#8696A0]'>
          These changes stay on this device and only affect this chat.
        </Text>
      </ScrollView>
    </View>
  )
}
