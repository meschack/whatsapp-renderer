import { View, Text, Pressable } from '@/src/tw'
import type { SavedChat } from '@/models/types'
import { GeneratedAvatar } from '@/components/shared/generated-avatar'

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
  return (
    <Pressable
      accessibilityLabel={`${chat.chatName}, ${chat.lastMessageText ?? 'Media message'}`}
      className='flex-row items-center gap-3 px-4 py-3'
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <GeneratedAvatar name={chat.chatName} size={52} />

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
      <Text className='text-wa-text-secondary mt-1 self-start text-xs'>
        {formatRelativeTime(chat.lastMessageTime)}
      </Text>
    </Pressable>
  )
}
