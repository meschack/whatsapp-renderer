import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { View, Text, Pressable } from '@/src/tw'

interface ChatHeaderProps {
  chatName: string
  participantCount: number
}

export function ChatHeader({ chatName, participantCount }: ChatHeaderProps) {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <View className='bg-wa-header' style={{ paddingTop: insets.top }}>
      <View className='flex-row items-center px-2 py-3 gap-2'>
        <Pressable className='p-2' onPress={() => router.back()}>
          <Ionicons name='arrow-back' size={24} color='#E9EDEF' />
        </Pressable>

        <View className='w-10 h-10 rounded-full bg-wa-icon/30 justify-center items-center'>
          <Ionicons name='person' size={22} color='#8696A0' />
        </View>

        <View className='flex-1 ml-1'>
          <Text className='text-wa-text-primary text-base font-semibold' numberOfLines={1}>
            {chatName}
          </Text>
          {participantCount > 0 && (
            <Text className='text-wa-text-secondary text-xs'>
              {participantCount} participants
            </Text>
          )}
        </View>

        <Pressable className='p-2'>
          <Ionicons name='search' size={22} color='#8696A0' />
        </Pressable>
        <Pressable className='p-2'>
          <Ionicons name='ellipsis-vertical' size={22} color='#8696A0' />
        </Pressable>
      </View>
    </View>
  )
}
