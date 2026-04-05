import type { Message } from '@/models/types'
import { Text, View } from '@/src/tw'
import { cn } from '@/utils/css'
import { memo, useCallback, useMemo, useState } from 'react'
import { LinkPreview } from './link-preview'
import { MessageMeta } from './message-meta'
import { MediaMessage } from './media-message'
import { RichText, extractFirstUrl } from './rich-text'

const MAX_CHARS = 500

interface ChatBubbleProps {
  message: Message
  showSender: boolean
}

export const ChatBubble = memo(function ChatBubble({ message }: ChatBubbleProps) {
  const isMine = message.isMine
  const hasMedia = message.mediaType !== null
  const hasText = message.text !== null && message.text.trim().length > 0
  const audioRendersOwnMeta = message.mediaType === 'audio' && !hasText
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
        className={cn(
          'relative max-w-[85%] min-w-20 rounded-lg',
          audioRendersOwnMeta ? 'min-w-[17.25rem] px-2 py-2' : 'px-2 pt-1.5 pb-1',
          isMine ? 'bg-wa-bubble-mine' : 'bg-wa-bubble-other'
        )}
      >
        {/* Media content */}
        {hasMedia && <MediaMessage message={message} />}

        {/* Link preview */}
        {firstUrl && <LinkPreview url={firstUrl} isMine={isMine} />}

        {/* Text content + timestamp row */}
        {hasText && displayText ? (
          <View>
            <View className='flex-row flex-wrap items-end'>
              <RichText text={displayText} isMine={isMine} />
              {!isTruncatable && !audioRendersOwnMeta && (
                <MessageMeta message={message} className='absolute right-px bottom-px' />
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
                {!audioRendersOwnMeta && (
                  <MessageMeta message={message} className='absolute right-px bottom-px' />
                )}
              </View>
            )}
          </View>
        ) : (
          !audioRendersOwnMeta && <MessageMeta message={message} className='absolute right-px bottom-px' />
        )}
      </View>
    </View>
  )
})
