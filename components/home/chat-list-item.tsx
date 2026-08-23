import { View, Text, Pressable } from '@/src/tw'
import type { SavedChat } from '@/models/types'
import { GeneratedAvatar } from '@/components/shared/generated-avatar'
import { Ionicons } from '@expo/vector-icons'
import { performHapticFeedback } from '@/utils/haptic-feedback'

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
      accessibilityHint='Double tap to open. Long press for chat actions.'
      accessibilityRole='button'
      className='flex-row items-center gap-3 px-4 py-3'
      onPress={onPress}
      onLongPress={() => {
        performHapticFeedback('action')
        onLongPress()
      }}
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

      <View className='mt-1 items-end gap-1 self-start'>
        <Text className='text-wa-text-secondary text-xs'>
          {formatRelativeTime(chat.lastMessageTime)}
        </Text>
        {chat.isPinned ? <Ionicons name='pin' size={14} color='#8696A0' /> : null}
      </View>
    </Pressable>
  )
}
