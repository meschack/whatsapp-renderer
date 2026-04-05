import type { Message } from '@/models/types'
import { Text, View } from '@/src/tw'
import { memo, useCallback, useMemo, useState } from 'react'
import { LinkPreview } from './LinkPreview'
import { MediaMessage } from './MediaMessage'
import { RichText, extractFirstUrl } from './RichText'

const MAX_CHARS = 500

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

export const ChatBubble = memo(function ChatBubble({ message, showSender }: ChatBubbleProps) {
  const isMine = message.isMine
  const hasMedia = message.mediaType !== null
  const hasText = message.text !== null && message.text.trim().length > 0
  const [expanded, setExpanded] = useState(false)

  const isTruncatable = hasText && message.text!.length > MAX_CHARS
  const displayText = useMemo(() => {
    if (!hasText || !message.text) return null
    if (!isTruncatable || expanded) return message.text
    return message.text.slice(0, MAX_CHARS).trimEnd() + '...'
  }, [hasText, message.text, isTruncatable, expanded])

  const toggleExpanded = useCallback(() => setExpanded(prev => !prev), [])

  const firstUrl = useMemo(
    () => (hasText && message.text ? extractFirstUrl(message.text) : null),
    [hasText, message.text]
  )

  return (
    <View className={`px-3 py-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
      <View
        className={`max-w-[85%] min-w-20 rounded-lg px-2 pt-1.5 pb-1 ${
          isMine ? 'bg-wa-bubble-mine' : 'bg-wa-bubble-other'
        }`}
      >
        {/* Sender name for group chats */}
        {showSender && !isMine && message.sender && (
          <Text className='text-wa-text-sender mb-0.5 text-[13px] font-medium'>
            {message.sender}
          </Text>
        )}

        {/* Media content */}
        {hasMedia && <MediaMessage message={message} />}

        {/* Link preview */}
        {firstUrl && <LinkPreview url={firstUrl} isMine={isMine} />}

        {/* Text content + timestamp row */}
        {hasText && displayText ? (
          <View>
            <View className='flex-row flex-wrap items-end'>
              <RichText text={displayText} isMine={isMine} />
              {!isTruncatable && (
                <Text
                  className={`mt-0.5 ml-2 text-[11px] ${
                    isMine ? 'text-white/60' : 'text-wa-text-timestamp'
                  }`}
                >
                  {formatTime(message.timestamp)}
                </Text>
              )}
            </View>
            {isTruncatable && (
              <View className='flex-row flex-wrap items-end'>
                <Text
                  className='text-wa-checkmark mt-1 text-[13px] font-medium'
                  onPress={toggleExpanded}
                >
                  {expanded ? 'See less' : 'See more'}
                </Text>
                <Text
                  className={`mt-0.5 ml-auto text-[11px] ${
                    isMine ? 'text-white/60' : 'text-wa-text-timestamp'
                  }`}
                >
                  {formatTime(message.timestamp)}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View className='mt-0.5 items-end'>
            <Text className={`text-[11px] ${isMine ? 'text-white/60' : 'text-wa-text-timestamp'}`}>
              {formatTime(message.timestamp)}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
})
