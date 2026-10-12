import { ThemedIonicons as Ionicons } from '@/components/shared/themed-icon'
import { Pressable, Text, View } from '@/src/tw'
import { CHAT_TEXT_SCALES } from '@/utils/chat-appearance'
import { APP_THEME_MODES } from '@/utils/app-theme'
import { useAppAppearance } from './app-appearance-provider'

const MODE_LABELS = { system: 'System', light: 'Light', dark: 'Dark' }
const SCALE_LABELS = { 0.9: 'Small', 1: 'Default', 1.15: 'Large' }
export function AppAppearanceSettings() {
  const { mode, defaultTextScale, colors, setMode, setDefaultTextScale } = useAppAppearance()
  return (
    <View className='bg-wa-header gap-5 rounded-2xl p-4'>
      <View className='flex-row items-center gap-2'>
        <Ionicons name='color-palette-outline' size={21} color={colors.accent} />
        <Text className='text-wa-text-primary text-lg font-semibold'>Appearance</Text>
      </View>
      <View className='gap-2'>
        <Text className='text-wa-text-secondary text-sm'>Theme</Text>
        <View className='flex-row flex-wrap gap-2'>
          {APP_THEME_MODES.map(option => (
            <Pressable
              key={option}
              testID={mode === option ? `app-theme-selected-${option}` : undefined}
              accessibilityRole='radio'
              accessibilityState={{ checked: mode === option }}
              accessibilityLabel={`${MODE_LABELS[option]} theme`}
              onPress={() => setMode(option)}
              className='min-h-11 flex-1 items-center justify-center rounded-xl border px-3'
              style={{
                borderColor: mode === option ? colors.accent : colors.divider,
                backgroundColor: mode === option ? colors.inputBackground : 'transparent'
              }}
            >
              <Text className='text-wa-text-primary font-medium'>{MODE_LABELS[option]}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View className='gap-2'>
        <Text className='text-wa-text-secondary text-sm'>Default reading text size</Text>
        <View className='flex-row flex-wrap gap-2'>
          {CHAT_TEXT_SCALES.map(scale => (
            <Pressable
              key={scale}
              accessibilityRole='radio'
              accessibilityState={{ checked: defaultTextScale === scale }}
              accessibilityLabel={`${SCALE_LABELS[scale]} default reading text`}
              onPress={() => setDefaultTextScale(scale)}
              className='min-h-11 flex-1 items-center justify-center rounded-xl border px-3'
              style={{
                borderColor: defaultTextScale === scale ? colors.accent : colors.divider,
                backgroundColor: defaultTextScale === scale ? colors.inputBackground : 'transparent'
              }}
            >
              <Text className='text-wa-text-primary font-medium' style={{ fontSize: 14 * scale }}>
                {SCALE_LABELS[scale]}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text className='text-wa-text-secondary text-xs'>
          Chats follow this size unless you choose a size in their appearance settings.
        </Text>
      </View>
    </View>
  )
}
