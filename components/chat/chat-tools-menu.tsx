import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from '@/src/tw'

interface ChatToolsMenuProps {
  diagnosticsCount: number
  onClose(): void
  onCalendar(): void
  onMedia(): void
  onBookmarks(): void
  onInsights(): void
  onDiagnostics?(): void
}

export function ChatToolsMenu({
  diagnosticsCount,
  onClose,
  onCalendar,
  onMedia,
  onBookmarks,
  onInsights,
  onDiagnostics
}: ChatToolsMenuProps) {
  const actions: {
    label: string
    icon: keyof typeof Ionicons.glyphMap
    onPress(): void
  }[] = [
    { label: 'Jump to date', icon: 'calendar-outline', onPress: onCalendar },
    { label: 'Chat media', icon: 'images-outline', onPress: onMedia },
    { label: 'Bookmarks', icon: 'bookmark-outline', onPress: onBookmarks },
    { label: 'Chat insights', icon: 'stats-chart-outline', onPress: onInsights }
  ]

  if (onDiagnostics && diagnosticsCount > 0) {
    actions.push({
      label: `Import report (${diagnosticsCount})`,
      icon: 'warning-outline',
      onPress: onDiagnostics
    })
  }

  return (
    <View className='absolute inset-0 z-20'>
      <Pressable
        accessibilityLabel='Close chat tools'
        className='absolute inset-0 bg-black/55'
        onPress={onClose}
      />
      <View className='absolute top-2 right-2 w-56 overflow-hidden rounded-xl border border-white/5 bg-[#202C33] py-1 shadow-lg'>
        {actions.map(action => (
          <Pressable
            key={action.label}
            accessibilityRole='button'
            className='min-h-12 flex-row items-center px-4 active:bg-white/10'
            onPress={() => {
              onClose()
              action.onPress()
            }}
          >
            <Ionicons
              name={action.icon}
              size={20}
              color={action.icon === 'warning-outline' ? '#F7C948' : '#AEBAC1'}
            />
            <Text className='ml-3 text-[14px] text-[#E9EDEF]'>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
