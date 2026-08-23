import type { Message } from '@/models/types'
import { Text, View } from '@/src/tw'
import { cn } from '@/utils/css'
import { memo, useCallback, useMemo } from 'react'
import { LinkPreview } from './link-preview'
import { InlineMessageMeta, MessageMeta } from './message-meta'
import { MediaMessage } from './media-message'
import { RichText, extractFirstUrl } from './rich-text'
import { useRecyclingState } from '@shopify/flash-list'

const MAX_CHARS = 500

interface ChatBubbleProps {
  message: Message
  showSender: boolean
}

export const ChatBubble = memo(function ChatBubble({ message, showSender }: ChatBubbleProps) {
  const isMine = message.isMine
  const hasMedia = message.mediaType !== null
  const hasText = message.text !== null && message.text.trim().length > 0
  const audioRendersOwnMeta = message.mediaType === 'audio' && !hasText
  const overlaysMeta =
    !hasText &&
    message.mediaUri !== null &&
    (message.mediaType === 'image' || message.mediaType === 'video')
  const [expanded, setExpanded] = useRecyclingState(false, [message.id])

  const isTruncatable = hasText && message.text!.length > MAX_CHARS
  const displayText = useMemo(() => {
    if (!hasText || !message.text) return null
    if (!isTruncatable || expanded) return message.text
    return message.text.slice(0, MAX_CHARS).trimEnd() + '...'
  }, [hasText, message.text, isTruncatable, expanded])

  const toggleExpanded = useCallback(() => setExpanded(previous => !previous), [setExpanded])

  const firstUrl = useMemo(
    () => (hasText && message.text ? extractFirstUrl(message.text) : null),
    [hasText, message.text]
  )

  return (
    <View
      className={`px-2 ${isMine ? 'items-end' : 'items-start'}`}
      style={{ marginTop: showSender ? 6 : 1 }}
    >
      <View
        className={cn(
          'relative max-w-[88%] min-w-16 rounded-xl',
          audioRendersOwnMeta ? 'px-2.5 py-2' : hasMedia && !hasText ? 'p-1' : 'px-2.5 pt-1.5 pb-1',
          isMine ? 'bg-wa-bubble-mine' : 'bg-wa-bubble-other'
        )}
        style={
          showSender
            ? isMine
              ? { borderTopRightRadius: 4 }
              : { borderTopLeftRadius: 4 }
            : undefined
        }
      >
        {/* Media content */}
        {hasMedia && <MediaMessage message={message} />}

        {/* Link preview */}
        {firstUrl && <LinkPreview url={firstUrl} isMine={isMine} />}

        {/* The timestamp is inline so it reserves space on the final text line. */}
        {hasText && displayText ? (
          <View>
            <RichText
              text={displayText}
              isMine={isMine}
              trailing={!audioRendersOwnMeta ? <InlineMessageMeta message={message} /> : undefined}
            />

            {isTruncatable && (
              <View>
                <Text
                  className='text-wa-checkmark mt-1 text-[13px] font-medium'
                  onPress={toggleExpanded}
                >
                  {expanded ? 'See less' : 'See more'}
                </Text>
              </View>
            )}
          </View>
        ) : !audioRendersOwnMeta && overlaysMeta ? (
          <View className='absolute right-1.5 bottom-1.5 rounded bg-black/25 px-1 py-0.5'>
            <MessageMeta message={message} textClassName='text-white/85' />
          </View>
        ) : !audioRendersOwnMeta ? (
          <View className='mt-0.5 items-end px-0.5'>
            <MessageMeta message={message} />
          </View>
        ) : null}
      </View>
    </View>
  )
})
