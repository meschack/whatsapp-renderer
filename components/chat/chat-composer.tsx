import { Text, View } from '@/src/tw'
import { Ionicons } from '@expo/vector-icons'
import { memo } from 'react'

/** Read-only composer chrome: this app renders exports, it does not send messages. */
export const ChatComposer = memo(function ChatComposer() {
  return (
    <View className='bg-wa-header h-14 flex-row items-center gap-2 px-2.5'>
      <View className='size-9 items-center justify-center'>
        <Ionicons name='add' size={29} color='#E9EDEF' />
      </View>

      <View className='bg-wa-input h-10 flex-1 flex-row items-center rounded-full px-3.5'>
        <Text className='text-wa-text-secondary flex-1 text-[15px]'>Message</Text>
        <Ionicons name='happy-outline' size={21} color='#AEBAC1' />
      </View>

      <View className='size-9 items-center justify-center'>
        <Ionicons name='camera-outline' size={24} color='#E9EDEF' />
      </View>
      <View className='size-9 items-center justify-center'>
        <Ionicons name='mic-outline' size={25} color='#E9EDEF' />
      </View>
    </View>
  )
})
