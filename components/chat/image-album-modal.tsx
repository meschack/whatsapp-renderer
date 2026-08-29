import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { memo } from 'react'
import { Modal, useWindowDimensions } from 'react-native'

import { Pressable, Text, View } from '@/src/tw'
import type { TimelineRecord } from '@/utils/chat-timeline'

interface ImageAlbumModalProps {
  chatName: string
  records: TimelineRecord[]
  onClose(): void
  onSelect(sequence: number): void
}

export function ImageAlbumModal({ chatName, records, onClose, onSelect }: ImageAlbumModalProps) {
  return (
    <Modal visible animationType='slide' statusBarTranslucent onRequestClose={onClose}>
      <View className='flex-1 bg-black'>
        <View className='z-10 flex-row items-center border-b border-white/10 bg-black px-2 pt-3 pb-2'>
          <Pressable
            accessibilityLabel='Close photo group'
            accessibilityRole='button'
            className='size-11 items-center justify-center rounded-full active:bg-white/10'
            onPress={onClose}
          >
            <Ionicons name='arrow-back' size={26} color='#FFFFFF' />
          </Pressable>
          <View className='ml-2 flex-1 items-center pr-14'>
            <Text className='text-[16px] font-semibold text-white' numberOfLines={1}>
              {chatName}
            </Text>
            <Text className='text-[12px] text-white/65'>{records.length} Photos</Text>
          </View>
        </View>

        <FlashList
          data={records}
          keyExtractor={item => item.message.id}
          renderItem={({ item }) => (
            <AlbumImage record={item} onPress={() => onSelect(item.sequence)} />
          )}
          contentContainerStyle={{ paddingBottom: 12 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  )
}

const AlbumImage = memo(function AlbumImage({
  record,
  onPress
}: {
  record: TimelineRecord
  onPress(): void
}) {
  const { width: screenWidth } = useWindowDimensions()
  const message = record.message
  const ratio =
    message.mediaWidth && message.mediaHeight && message.mediaWidth > 0
      ? message.mediaHeight / message.mediaWidth
      : 1
  const height = Math.max(180, Math.min(screenWidth * ratio, screenWidth * 2.5))
  const source = message.mediaUri ?? message.mediaPreviewUri

  return (
    <Pressable
      accessibilityLabel='Open photo full screen'
      accessibilityRole='button'
      className='mb-2 bg-[#111B21]'
      onPress={onPress}
    >
      {source ? (
        <Image
          source={{ uri: source }}
          placeholder={message.mediaPreviewUri ? { uri: message.mediaPreviewUri } : undefined}
          recyclingKey={`album-full-${message.id}-${source}`}
          contentFit='contain'
          transition={120}
          style={{ width: screenWidth, height }}
        />
      ) : (
        <View style={{ width: screenWidth, height }} className='items-center justify-center'>
          <Ionicons name='cloud-offline-outline' size={42} color='#8696A0' />
        </View>
      )}
    </Pressable>
  )
})
