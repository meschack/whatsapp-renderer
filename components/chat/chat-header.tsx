import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { View, Text, Pressable } from '@/src/tw'
import { GeneratedAvatar } from '@/components/shared/generated-avatar'

interface ChatHeaderProps {
  chatName: string
  participantCount: number
  onSearchPress?: () => void
  diagnosticsCount?: number
  onMorePress?: () => void
}

export function ChatHeader({
  chatName,
  participantCount,
  onSearchPress,
  diagnosticsCount = 0,
  onMorePress
}: ChatHeaderProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View className='bg-wa-header' style={{ paddingTop: insets.top }}>
      <View className='h-15 flex-row items-center gap-1.5 px-2'>
        <Pressable className='size-10 items-center justify-center' onPress={() => router.back()}>
          <Ionicons name='chevron-back' size={29} color='#E9EDEF' />
        </Pressable>

        <GeneratedAvatar name={chatName} size={38} />

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
          {onSearchPress && (
            <Pressable
              accessibilityLabel='Search messages'
              className='size-9 items-center justify-center'
              onPress={onSearchPress}
            >
              <Ionicons name='search-outline' size={22} color='#E9EDEF' />
            </Pressable>
          )}
          {onMorePress && (
            <Pressable
              accessibilityLabel='Open chat tools'
              className='size-9 items-center justify-center'
              onPress={onMorePress}
            >
              <Ionicons name='ellipsis-vertical' size={21} color='#E9EDEF' />
              {diagnosticsCount > 0 ? (
                <View className='absolute top-0.5 right-0.5 min-w-3.5 items-center rounded-full bg-[#F7C948] px-0.5'>
                  <Text className='text-[8px] font-bold text-[#111B21]'>
                    {diagnosticsCount > 99 ? '99+' : diagnosticsCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          )}
        </View>
      </View>
    </View>
  )
}
