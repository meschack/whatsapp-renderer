import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { View, Text, Pressable } from '@/src/tw'

interface ChatHeaderProps {
  chatName: string
  participantCount: number
  onSearchPress?: () => void
  onMediaPress?: () => void
  onBookmarksPress?: () => void
  diagnosticsCount?: number
  onDiagnosticsPress?: () => void
  onCalendarPress?: () => void
}

export function ChatHeader({
  chatName,
  participantCount,
  onSearchPress,
  onMediaPress,
  onBookmarksPress,
  diagnosticsCount = 0,
  onDiagnosticsPress,
  onCalendarPress
}: ChatHeaderProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View className='bg-wa-header' style={{ paddingTop: insets.top }}>
      <View className='h-15 flex-row items-center gap-1.5 px-2'>
        <Pressable className='size-10 items-center justify-center' onPress={() => router.back()}>
          <Ionicons name='chevron-back' size={29} color='#E9EDEF' />
        </Pressable>

        <View className='bg-wa-icon/30 size-9.5 items-center justify-center rounded-full'>
          <Ionicons name='person' size={21} color='#AEBAC1' />
        </View>

        <View className='ml-1 flex-1'>
          <Text className='text-wa-text-primary text-[16px] font-medium' numberOfLines={1}>
            {chatName}
          </Text>
          {participantCount > 2 && (
            <Text className='text-wa-text-secondary text-[11px]'>
              {participantCount} participants
            </Text>
          )}
        </View>

        <View className='h-10 flex-row items-center rounded-full border border-white/5 bg-black/10 px-1'>
          {onDiagnosticsPress && diagnosticsCount > 0 && (
            <Pressable
              accessibilityLabel={`View ${diagnosticsCount} import notices`}
              className='size-9 items-center justify-center'
              onPress={onDiagnosticsPress}
            >
              <Ionicons name='warning-outline' size={20} color='#F7C948' />
              <View className='absolute top-0.5 right-0.5 min-w-3.5 items-center rounded-full bg-[#F7C948] px-0.5'>
                <Text className='text-[8px] font-bold text-[#111B21]'>
                  {diagnosticsCount > 99 ? '99+' : diagnosticsCount}
                </Text>
              </View>
            </Pressable>
          )}
          {onCalendarPress && (
            <Pressable
              accessibilityLabel='Jump to date'
              className='size-9 items-center justify-center'
              onPress={onCalendarPress}
            >
              <Ionicons name='calendar-outline' size={20} color='#E9EDEF' />
            </Pressable>
          )}
          {onBookmarksPress && (
            <Pressable
              accessibilityLabel='Browse bookmarks'
              className='size-9 items-center justify-center'
              onPress={onBookmarksPress}
            >
              <Ionicons name='bookmark-outline' size={20} color='#E9EDEF' />
            </Pressable>
          )}
          {onMediaPress && (
            <Pressable
              accessibilityLabel='Browse chat media'
              className='size-9 items-center justify-center'
              onPress={onMediaPress}
            >
              <Ionicons name='images-outline' size={21} color='#E9EDEF' />
            </Pressable>
          )}
          {onSearchPress && (
            <Pressable
              accessibilityLabel='Search messages'
              className='size-9 items-center justify-center'
              onPress={onSearchPress}
            >
              <Ionicons name='search-outline' size={22} color='#E9EDEF' />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  )
}
