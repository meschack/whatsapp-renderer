import type { Message } from '@/models/types'
import { Pressable, Text, View } from '@/src/tw'
import { Image } from '@/src/tw/image'
import { Ionicons } from '@expo/vector-icons'
import type { ImageLoadEventData } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { memo, useCallback, useState } from 'react'
import { Modal, useWindowDimensions } from 'react-native'
import { AudioPlayer } from './AudioPlayer'

interface MediaMessageProps {
  message: Message
}

export const MediaMessage = memo(function MediaMessage({ message }: MediaMessageProps) {
  const [imageModalVisible, setImageModalVisible] = useState(false)

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
      if (message.mediaUri.toUpperCase().includes('STICKER')) {
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
      return <AudioPlayer uri={message.mediaUri} isMine={message.isMine} />

    case 'document':
      return <DocumentMessage uri={message.mediaUri} />

    default:
      return null
  }
})

const IMAGE_MAX_WIDTH = 250
const IMAGE_MIN_HEIGHT = 100
const IMAGE_MAX_HEIGHT = 350

const STICKER_SIZE = IMAGE_MAX_WIDTH / 2

const Sticker = memo(function Sticker({ uri }: { uri: string }) {
  const [height, setHeight] = useState(STICKER_SIZE)

  const handleLoad = useCallback((e: ImageLoadEventData) => {
    const { width: srcW, height: srcH } = e.source
    if (srcW > 0 && srcH > 0) {
      setHeight(Math.round(STICKER_SIZE * (srcH / srcW)))
    }
  }, [])

  return (
    <Image
      source={{ uri }}
      className='object-contain'
      style={{ width: STICKER_SIZE, height }}
      onLoad={handleLoad}
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
  const [imageHeight, setImageHeight] = useState(IMAGE_MAX_WIDTH)
  const { width: screenWidth } = useWindowDimensions()

  const handleLoad = useCallback((e: ImageLoadEventData) => {
    const { width: srcW, height: srcH } = e.source
    if (srcW > 0 && srcH > 0) {
      const computed = Math.round(IMAGE_MAX_WIDTH * (srcH / srcW))
      setImageHeight(Math.max(IMAGE_MIN_HEIGHT, Math.min(IMAGE_MAX_HEIGHT, computed)))
    }
  }, [])

  return (
    <>
      <Pressable onPress={onOpenModal}>
        <Image
          source={{ uri }}
          className='rounded-lg object-cover'
          style={{ width: IMAGE_MAX_WIDTH, height: imageHeight }}
          onLoad={handleLoad}
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
      <View className='bg-wa-accent/20 h-10 w-10 items-center justify-center rounded-lg'>
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
  const [activated, setActivated] = useState(false)

  if (!activated) {
    return (
      <Pressable
        className='h-[250px] w-[250px] items-center justify-center overflow-hidden rounded-lg bg-black/50'
        onPress={() => setActivated(true)}
      >
        <View className='h-14 w-14 items-center justify-center rounded-full bg-white/20'>
          <Ionicons name='play' size={32} color='#FFFFFF' />
        </View>
      </Pressable>
    )
  }

  return <ActiveVideoPlayer uri={uri} />
})

function ActiveVideoPlayer({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri)

  const handleLayout = useCallback(() => {
    player.play()
  }, [player])

  return (
    <View className='h-[250px] w-[250px] overflow-hidden rounded-lg' onLayout={handleLayout}>
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
