import type { Message } from '@/models/types'
import { Text, View } from '@/src/tw'
import { Ionicons } from '@expo/vector-icons'
import { cn } from '@/utils/css'
import { useChatAppearance } from './chat-appearance-context'

function formatTime(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h = hours % 12 || 12
  return `${h}:${minutes.toString().padStart(2, '0')}\u00A0${ampm}`
}

export function formatMessageTimestamp(message: Message): string {
  const time = formatTime(message.timestamp)
  return message.isEdited ? `Edited ${time}` : time
}

export function MessageMeta({
  message,
  className,
  textClassName
}: {
  message: Message
  className?: string
  textClassName?: string
}) {
  const { textScale } = useChatAppearance()
  return (
    <View className={cn('flex-row items-center gap-1', className)}>
      <Text
        style={{ fontSize: 11 * textScale }}
        className={cn(
          'text-[11px]',
          message.isMine ? 'text-white/60' : 'text-wa-text-timestamp',
          textClassName
        )}
      >
        {formatMessageTimestamp(message)}
      </Text>
      {message.isMine && <Ionicons name='checkmark-done' size={14} color='#53BDEB' />}
    </View>
  )
}

/** Text-native metadata participates in line wrapping instead of covering message copy. */
export function InlineMessageMeta({ message }: { message: Message }) {
  const { textScale } = useChatAppearance()
  return (
    <Text style={{ fontSize: 11 * textScale, lineHeight: 20 * textScale }}>
      {'  '}
      <Text className={message.isMine ? 'text-white/60' : 'text-wa-text-timestamp'}>
        {formatMessageTimestamp(message)}
      </Text>
      {message.isMine && (
        <>
          {'\u00A0'}
          <Ionicons name='checkmark-done' size={13} color='#53BDEB' />
        </>
      )}
    </Text>
  )
}
