import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { memo } from 'react'
import { useWindowDimensions } from 'react-native'

import { Pressable, Text, View } from '@/src/tw'
import type { TimelineRecord } from '@/utils/chat-timeline'
import { getImageGridPresentation } from '@/utils/image-gallery'
import { performHapticFeedback } from '@/utils/haptic-feedback'
import { MessageMeta } from './message-meta'
import { useChatAppearance } from './chat-appearance-context'

interface ImageGroupBubbleProps {
  records: TimelineRecord[]
  showSender: boolean
  showSenderName?: boolean
  senderColor?: string
  highlighted?: boolean
  onOpen(): void
  onLongPress(): void
}

export const ImageGroupBubble = memo(function ImageGroupBubble({
  records,
  showSender,
  showSenderName = false,
  senderColor,
  highlighted = false,
  onOpen,
  onLongPress
}: ImageGroupBubbleProps) {
  const first = records[0]?.message
  const last = records.at(-1)?.message
  const { width: screenWidth } = useWindowDimensions()
  const { textScale } = useChatAppearance()
  if (!first || !last) return null

  const presentation = getImageGridPresentation(records.length)
  const visible = records.slice(0, presentation.tileCount)
  const gridWidth = Math.min(310, screenWidth * 0.84)
  const gridHeight = presentation.layout === 'pair' ? 210 : 270

  return (
    <View className={`px-2 ${first.isMine ? 'items-end' : 'items-start'}`}>
      <Pressable
        accessibilityLabel={`Open ${records.length} photos`}
        accessibilityHint='Shows every photo in this group'
        accessibilityRole='button'
        delayLongPress={500}
        onPress={onOpen}
        onLongPress={() => {
          performHapticFeedback('action')
          onLongPress()
        }}
        className={`overflow-hidden rounded-xl p-1 ${
          first.isMine ? 'bg-wa-bubble-mine' : 'bg-wa-bubble-other'
        }`}
        style={[
          { marginTop: showSender ? 6 : 1 },
          showSender
            ? first.isMine
              ? { borderTopRightRadius: 4 }
              : { borderTopLeftRadius: 4 }
            : undefined,
          highlighted
            ? { borderColor: '#00C896', borderWidth: 2, shadowColor: '#00A884', elevation: 4 }
            : undefined
        ]}
      >
        {showSenderName && first.sender ? (
          <Text
            className='mx-1 mb-1 font-semibold'
            numberOfLines={1}
            style={{ color: senderColor, fontSize: 12.5 * textScale }}
          >
            {first.sender}
          </Text>
        ) : null}

        <View
          className='overflow-hidden rounded-lg bg-black/25'
          style={{ width: gridWidth, height: gridHeight }}
        >
          {presentation.layout === 'pair' ? (
            <View className='flex-1 flex-row gap-[3px]'>
              {visible.map((record, index) => (
                <GalleryTile
                  key={record.message.id}
                  record={record}
                  hiddenCount={index === visible.length - 1 ? presentation.hiddenCount : 0}
                />
              ))}
            </View>
          ) : presentation.layout === 'trio' ? (
            <View className='flex-1 flex-row gap-[3px]'>
              <GalleryTile record={visible[0]} />
              <View className='flex-1 gap-[3px]'>
                <GalleryTile record={visible[1]} />
                <GalleryTile record={visible[2]} />
              </View>
            </View>
          ) : (
            <View className='flex-1 gap-[3px]'>
              <View className='flex-1 flex-row gap-[3px]'>
                <GalleryTile record={visible[0]} />
                <GalleryTile record={visible[1]} />
              </View>
              <View className='flex-1 flex-row gap-[3px]'>
                <GalleryTile record={visible[2]} />
                <GalleryTile record={visible[3]} hiddenCount={presentation.hiddenCount} />
              </View>
            </View>
          )}
        </View>

        <View className='mt-0.5 flex-row items-center justify-end px-1'>
          <MessageMeta message={last} />
        </View>
      </Pressable>
    </View>
  )
})

const GalleryTile = memo(function GalleryTile({
  record,
  hiddenCount = 0
}: {
  record: TimelineRecord
  hiddenCount?: number
}) {
  const message = record.message
  const source = message.mediaPreviewUri ?? message.mediaUri
  return (
    <View className='min-h-0 min-w-0 flex-1 overflow-hidden bg-[#202C33]'>
      {source ? (
        <Image
          source={{ uri: source }}
          recyclingKey={`album-thumb-${message.id}-${source}`}
          contentFit='cover'
          blurRadius={hiddenCount > 0 ? 12 : 0}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <View className='flex-1 items-center justify-center'>
          <Ionicons name='cloud-offline-outline' size={28} color='#8696A0' />
        </View>
      )}
      {hiddenCount > 0 ? (
        <View className='absolute inset-0 items-center justify-center bg-black/55'>
          <Text className='text-[42px] font-medium text-white'>+{hiddenCount}</Text>
        </View>
      ) : null}
    </View>
  )
})
