import type { Ref } from 'react'
import type { View as NativeView } from 'react-native'
import { Pressable, Text, View } from '@/src/tw'
import { ThemedIonicons as Ionicons } from '@/components/shared/themed-icon'
import { memo } from 'react'
import { useAppAppearance } from '@/components/settings/app-appearance-provider'

export interface ReaderToolbarProps {
  buttonRefs?: Record<string, Ref<NativeView>>
  onSearch?: () => void
  onBookmarks?: () => void
  onCalendar?: () => void
  onLatest?: () => void
}
/** Reader actions for an imported transcript. Every control does useful work. */
export const ChatComposer = memo(function ChatComposer({
  buttonRefs,
  onSearch,
  onBookmarks,
  onCalendar,
  onLatest
}: ReaderToolbarProps) {
  const { colors } = useAppAppearance()
  const actions = [
    { label: 'Search', icon: 'search-outline' as const, onPress: onSearch },
    {
      label: 'Saved',
      accessibilityLabel: 'Open bookmarked messages',
      icon: 'bookmark-outline' as const,
      onPress: onBookmarks
    },
    {
      label: 'Date',
      accessibilityLabel: 'Jump to a date',
      icon: 'calendar-outline' as const,
      onPress: onCalendar
    },
    {
      label: 'Latest',
      accessibilityLabel: 'Jump to latest message',
      icon: 'arrow-down-outline' as const,
      onPress: onLatest
    }
  ]
  return (
    <View className='bg-wa-header border-wa-divider min-h-14 flex-row items-center border-t px-2 py-1'>
      {actions.map(action => (
        <Pressable
          key={action.label}
          ref={buttonRefs?.[action.label]}
          accessibilityRole='button'
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          accessibilityState={{ disabled: !action.onPress }}
          disabled={!action.onPress}
          onPress={action.onPress}
          className='active:bg-wa-input min-h-12 flex-1 items-center justify-center gap-0.5 rounded-xl'
          style={{ opacity: action.onPress ? 1 : 0.4 }}
        >
          <Ionicons name={action.icon} size={20} color={colors.iconColor} />
          <Text className='text-wa-text-secondary text-[11px]'>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  )
})
