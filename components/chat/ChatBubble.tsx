import { View, Text } from '@/src/tw'
import { MediaMessage } from './MediaMessage'
import type { Message } from '@/models/types'

interface ChatBubbleProps {
  message: Message
  showSender: boolean
}

function formatTime(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${minutes.toString().padStart(2, '0')} ${ampm}`
}

export function ChatBubble({ message, showSender }: ChatBubbleProps) {
  const isMine = message.isMine
  const hasMedia = message.mediaType !== null
  const hasText = message.text !== null && message.text.trim().length > 0

  return (
    <View className={`px-3 py-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
      <View
        className={`rounded-lg px-2 pt-1.5 pb-1 max-w-[85%] min-w-[80px] ${
          isMine ? 'bg-wa-bubble-mine' : 'bg-wa-bubble-other'
        }`}
      >
        {/* Sender name for group chats */}
        {showSender && !isMine && message.sender && (
          <Text className='text-wa-text-sender text-[13px] font-medium mb-0.5'>
            {message.sender}
          </Text>
        )}

        {/* Media content */}
        {hasMedia && <MediaMessage message={message} />}

        {/* Text content + timestamp row */}
        {hasText ? (
          <View className='flex-row flex-wrap items-end'>
            <Text className='text-wa-text-primary text-[14.5px] leading-5 flex-shrink'>
              {message.text}
            </Text>
            <Text
              className={`text-[11px] ml-2 mt-0.5 ${
                isMine ? 'text-white/60' : 'text-wa-text-timestamp'
              }`}
            >
              {formatTime(message.timestamp)}
            </Text>
          </View>
        ) : (
          <View className='items-end mt-0.5'>
            <Text
              className={`text-[11px] ${
                isMine ? 'text-white/60' : 'text-wa-text-timestamp'
              }`}
            >
              {formatTime(message.timestamp)}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}
