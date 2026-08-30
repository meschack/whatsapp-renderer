import type { Message } from '@/models/types'
import { Pressable, Text, View } from '@/src/tw'
import { cn } from '@/utils/css'
import { memo, useCallback, useMemo } from 'react'
import { LinkPreview } from './link-preview'
import { InlineMessageMeta, MessageMeta } from './message-meta'
import { MediaMessage } from './media-message'
import { RichText, extractFirstUrl } from './rich-text'
import { useRecyclingState } from '@shopify/flash-list'
import { getMessageAccessibilityLabel } from '@/utils/accessibility'
import { performHapticFeedback } from '@/utils/haptic-feedback'
import { useChatAppearance } from './chat-appearance-context'
import {
  getChatMediaPreviewSize,
  getChatVideoPreviewSize,
  getChatVisualBubbleWidth,
  isStickerMediaUri
} from '@/utils/chat-media-layout'
import { useWindowDimensions } from 'react-native'

const MAX_CHARS = 500

interface ChatBubbleProps {
  message: Message
  showSender: boolean
  showSenderName?: boolean
  senderColor?: string
  highlighted?: boolean
  onOpenImage?: () => void
  onLongPress?: () => void
}

export const ChatBubble = memo(function ChatBubble({
  message,
  showSender,
  showSenderName = false,
  senderColor,
  highlighted = false,
  onOpenImage,
  onLongPress
}: ChatBubbleProps) {
  const isMine = message.isMine
  const { textScale } = useChatAppearance()
  const { width: screenWidth } = useWindowDimensions()
  const hasMedia = message.mediaType !== null
  const hasText = message.text !== null && message.text.trim().length > 0
  const hasVisualMedia = message.mediaType === 'image' || message.mediaType === 'video'
  const audioRendersOwnMeta = message.mediaType === 'audio' && !hasText
  const overlaysMeta =
    !hasText &&
    message.mediaUri !== null &&
    (message.mediaType === 'image' || message.mediaType === 'video')
  const [expanded, setExpanded] = useRecyclingState(false, [message.id])

  const visualBubbleWidth = useMemo(() => {
    if (!message.mediaUri) return undefined

    if (message.mediaType === 'image' && !isStickerMediaUri(message.mediaUri)) {
      const preview = getChatMediaPreviewSize(screenWidth, message.mediaWidth, message.mediaHeight)
      return getChatVisualBubbleWidth(preview.width)
    }

    if (message.mediaType === 'video') {
      const preview = getChatVideoPreviewSize(screenWidth, message.mediaWidth, message.mediaHeight)
      return getChatVisualBubbleWidth(preview.width)
    }

    return undefined
  }, [message.mediaHeight, message.mediaType, message.mediaUri, message.mediaWidth, screenWidth])

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
    <Pressable
      accessibilityLabel={getMessageAccessibilityLabel(message)}
      accessibilityHint='Long press for message actions'
      accessibilityRole='button'
      className={`px-2 ${isMine ? 'items-end' : 'items-start'}`}
      style={{ marginTop: showSender ? 6 : 1 }}
      delayLongPress={500}
      onLongPress={() => {
        performHapticFeedback('action')
        onLongPress?.()
      }}
    >
      <View
        className={cn(
          'relative max-w-[88%] min-w-16 rounded-xl',
          hasVisualMedia
            ? 'p-1'
            : audioRendersOwnMeta
              ? 'px-2.5 py-2'
              : hasMedia && !hasText
                ? 'p-1'
                : 'px-2.5 pt-1.5 pb-1',
          isMine ? 'bg-wa-bubble-mine' : 'bg-wa-bubble-other'
        )}
        style={[
          showSender
            ? isMine
              ? { borderTopRightRadius: 4 }
              : { borderTopLeftRadius: 4 }
            : undefined,
          highlighted
            ? {
                borderColor: '#00C896',
                borderWidth: 2,
                shadowColor: '#00A884',
                shadowOpacity: 0.35,
                shadowRadius: 5,
                elevation: 4
              }
            : undefined,
          visualBubbleWidth === undefined ? undefined : { width: visualBubbleWidth }
        ]}
      >
        {showSenderName && message.sender ? (
          <Text
            className={cn('mb-0.5 font-semibold', hasVisualMedia && 'mx-1.5 mt-0.5')}
            numberOfLines={1}
            style={{ color: senderColor, fontSize: 12.5 * textScale }}
          >
            {message.sender}
          </Text>
        ) : null}

        {/* Media content */}
        {hasMedia && <MediaMessage message={message} onOpenImage={onOpenImage} />}

        {/* Link preview */}
        {firstUrl && <LinkPreview url={firstUrl} isMine={isMine} />}

        {/* The timestamp is inline so it reserves space on the final text line. */}
        {hasText && displayText ? (
          <View className={hasVisualMedia ? 'px-1.5 pt-1' : undefined}>
            <RichText
              text={displayText}
              isMine={isMine}
              trailing={!audioRendersOwnMeta ? <InlineMessageMeta message={message} /> : undefined}
            />

            {isTruncatable && (
              <View>
                <Text
                  className='text-wa-checkmark mt-1 font-medium'
                  style={{ fontSize: 13 * textScale }}
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
    </Pressable>
  )
})
