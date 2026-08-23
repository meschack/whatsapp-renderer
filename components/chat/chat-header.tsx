import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { View, Text, Pressable } from '@/src/tw'

interface ChatHeaderProps {
  chatName: string
  participantCount: number
  onSearchPress?: () => void
}

export function ChatHeader({ chatName, participantCount, onSearchPress }: ChatHeaderProps) {
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
          {onSearchPress && (
            <Pressable
              accessibilityLabel='Search messages'
              className='size-9 items-center justify-center'
              onPress={onSearchPress}
            >
              <Ionicons name='search-outline' size={22} color='#E9EDEF' />
            </Pressable>
          )}
          <Pressable className='size-9 items-center justify-center'>
            <Ionicons name='videocam-outline' size={23} color='#E9EDEF' />
          </Pressable>
          <Pressable className='size-9 items-center justify-center'>
            <Ionicons name='call-outline' size={23} color='#E9EDEF' />
          </Pressable>
        </View>
      </View>
    </View>
  )
}
