import type { Message } from '@/models/types'
import { Pressable, Text, View } from '@/src/tw'
import { Image } from '@/src/tw/image'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { memo, useCallback } from 'react'
import { Modal, useWindowDimensions } from 'react-native'
import { AudioPlayer } from './audio-player'
import { useRecyclingState } from '@shopify/flash-list'

interface MediaMessageProps {
  message: Message
}

export const MediaMessage = memo(function MediaMessage({ message }: MediaMessageProps) {
  const [imageModalVisible, setImageModalVisible] = useRecyclingState(false, [message.id])

  if (!message.mediaType) return null

  if (!message.mediaUri) {
    return (
      <View className='flex-row items-center gap-2 py-2'>
        <Ionicons
          name={getMediaIcon(message.mediaType)}
          size={20}
          color={message.isMine ? '#E9EDEF' : '#8696A0'}
        />
        <Text
          className={`text-sm italic ${message.isMine ? 'text-white/70' : 'text-wa-text-secondary'}`}
        >
          {getMediaLabel(message.mediaType)}
        </Text>
      </View>
    )
  }

  switch (message.mediaType) {
    case 'image': {
      if (isStickerUri(message.mediaUri)) {
        return <Sticker uri={message.mediaUri} />
      }
      return (
        <ChatImage
          uri={message.mediaUri}
          isModalVisible={imageModalVisible}
          onOpenModal={() => setImageModalVisible(true)}
          onCloseModal={() => setImageModalVisible(false)}
        />
      )
    }

    case 'video':
      return <LazyVideoMessage uri={message.mediaUri} />

    case 'audio':
      return (
        <AudioPlayer
          message={message}
          showMeta={message.text === null || message.text.trim().length === 0}
        />
      )

    case 'document':
      return <DocumentMessage uri={message.mediaUri} />

    default:
      return null
  }
})

function isStickerUri(uri: string): boolean {
  const encodedFilename = uri.split('/').pop()?.split(/[?#]/)[0] ?? ''
  let filename = encodedFilename

  try {
    filename = decodeURIComponent(encodedFilename)
  } catch {
    // A malformed URI should still render as an ordinary image, not crash the chat.
  }

  return /^(?:STK-|STICKER)/i.test(filename) && filename.toLowerCase().endsWith('.webp')
}

const MEDIA_MAX_WIDTH = 300
const MEDIA_ASPECT_RATIO = 1.38

const STICKER_SIZE = 128

const Sticker = memo(function Sticker({ uri }: { uri: string }) {
  return (
    <Image
      source={{ uri }}
      recyclingKey={uri}
      className='object-contain'
      style={{ width: STICKER_SIZE, height: STICKER_SIZE }}
    />
  )
})

interface ChatImageProps {
  uri: string
  isModalVisible: boolean
  onOpenModal: () => void
  onCloseModal: () => void
}

const ChatImage = memo(function ChatImage({
  uri,
  isModalVisible,
  onOpenModal,
  onCloseModal
}: ChatImageProps) {
  const { width: screenWidth } = useWindowDimensions()
  const previewWidth = Math.min(MEDIA_MAX_WIDTH, screenWidth * 0.78)
  const previewHeight = previewWidth / MEDIA_ASPECT_RATIO

  return (
    <>
      <Pressable onPress={onOpenModal}>
        <Image
          source={{ uri }}
          recyclingKey={uri}
          className='rounded-lg object-cover'
          style={{ width: previewWidth, height: previewHeight }}
        />
      </Pressable>
      {isModalVisible && (
        <Modal visible transparent animationType='fade' onRequestClose={onCloseModal}>
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.95)',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            onPress={onCloseModal}
          >
            <Image
              source={{ uri }}
              recyclingKey={`modal-${uri}`}
              className='object-contain'
              style={{ width: screenWidth, height: '80%' }}
            />
          </Pressable>
        </Modal>
      )}
    </>
  )
})

const DocumentMessage = memo(function DocumentMessage({ uri }: { uri: string }) {
  return (
    <View className='flex-row items-center gap-3 px-1 py-2'>
      <View className='bg-wa-accent/20 size-10 items-center justify-center rounded-lg'>
        <Ionicons name='document' size={22} color='#00A884' />
      </View>
      <View className='flex-1'>
        <Text className='text-wa-text-primary text-sm' numberOfLines={1}>
          {uri.split('/').pop() ?? 'Document'}
        </Text>
        <Text className='text-wa-text-secondary text-[11px]'>Document</Text>
      </View>
    </View>
  )
})

// Only create the native video player when the user taps play
const LazyVideoMessage = memo(function LazyVideoMessage({ uri }: { uri: string }) {
  const [activated, setActivated] = useRecyclingState(false, [uri])
  const { width: screenWidth } = useWindowDimensions()
  const previewWidth = Math.min(MEDIA_MAX_WIDTH, screenWidth * 0.78)
  const previewHeight = previewWidth / MEDIA_ASPECT_RATIO

  if (!activated) {
    return (
      <Pressable
        className='items-center justify-center overflow-hidden rounded-lg bg-black/50'
        style={{ width: previewWidth, height: previewHeight }}
        onPress={() => setActivated(true)}
      >
        <View className='size-14 items-center justify-center rounded-full bg-white/20'>
          <Ionicons name='play' size={32} color='#FFFFFF' />
        </View>
      </Pressable>
    )
  }

  return <ActiveVideoPlayer uri={uri} width={previewWidth} height={previewHeight} />
})

function ActiveVideoPlayer({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer(uri)

  const handleLayout = useCallback(() => {
    player.play()
  }, [player])

  return (
    <View className='overflow-hidden rounded-lg' style={{ width, height }} onLayout={handleLayout}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit='cover'
        nativeControls
      />
    </View>
  )
}

function getMediaIcon(type: Message['mediaType']): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'image':
      return 'image'
    case 'video':
      return 'videocam'
    case 'audio':
      return 'mic'
    case 'document':
      return 'document'
    default:
      return 'attach'
  }
}

function getMediaLabel(type: Message['mediaType']): string {
  switch (type) {
    case 'image':
      return 'Photo'
    case 'video':
      return 'Video'
    case 'audio':
      return 'Voice message'
    case 'document':
      return 'Document'
    default:
      return 'Media'
  }
}
