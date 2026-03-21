import { Ionicons } from '@expo/vector-icons'
import { View, Text, Pressable } from '@/src/tw'
import type { SavedChat } from '@/models/types'

interface ChatListItemProps {
  chat: SavedChat
  onPress: () => void
  onLongPress: () => void
}

const formatRelativeTime = (isoString: string): string => {
  const date = new Date(isoString)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date >= today) {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const h = hours % 12 || 12
    return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`
  }

  if (date >= yesterday) {
    return 'Yesterday'
  }

  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

export const ChatListItem = ({ chat, onPress, onLongPress }: ChatListItemProps) => {
  const isGroup = chat.participants.length > 2

  return (
    <Pressable className='flex-row items-center px-4 py-3 gap-3' onPress={onPress} onLongPress={onLongPress}>
      {/* Avatar */}
      <View className='w-[52px] h-[52px] rounded-full bg-wa-header justify-center items-center'>
        <Ionicons name={isGroup ? 'people' : 'person'} size={26} color='#8696A0' />
      </View>

      {/* Name + last message */}
      <View className='flex-1 gap-0.5'>
        <Text className='text-wa-text-primary text-[16.5px] font-medium' numberOfLines={1}>
          {chat.chatName}
        </Text>
        <Text className='text-wa-text-secondary text-sm' numberOfLines={1}>
          {chat.lastMessageText ?? 'Media message'}
        </Text>
      </View>

      {/* Timestamp */}
      <Text className='text-wa-text-secondary text-xs self-start mt-1'>
        {formatRelativeTime(chat.lastMessageTime)}
      </Text>
    </Pressable>
  )
}
