import type { Message } from '@/models/types'
import { Pressable, Text, View } from '@/src/tw'
import { Image } from '@/src/tw/image'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { memo, useCallback, useMemo } from 'react'
import { Alert, useWindowDimensions } from 'react-native'
import { AudioPlayer } from './audio-player'
import { useRecyclingState } from '@shopify/flash-list'
import { MediaFileActionError, openLocalFile, shareLocalFile } from '@/utils/media-file-actions'
import { formatFileSize, getDecodedFilename, getDocumentPresentation } from '@/utils/media-file'
import { useChatAppearance } from './chat-appearance-context'
import {
  getChatMediaPreviewSize,
  getChatVideoPreviewSize,
  isStickerMediaUri
} from '@/utils/chat-media-layout'

interface MediaMessageProps {
  message: Message
  onOpenImage?: () => void
}

export const MediaMessage = memo(function MediaMessage({
  message,
  onOpenImage
}: MediaMessageProps) {
  const { textScale } = useChatAppearance()

  if (!message.mediaType) return null

  if (message.mediaType === 'document') {
    return <DocumentMessage message={message} textScale={textScale} />
  }

  if (!message.mediaUri) {
    return <UnavailableMedia message={message} textScale={textScale} />
  }

  switch (message.mediaType) {
    case 'image': {
      if (isStickerMediaUri(message.mediaUri)) {
        return <Sticker uri={message.mediaUri} />
      }
      return (
        <ChatImage
          uri={message.mediaUri}
          previewUri={message.mediaPreviewUri}
          width={message.mediaWidth}
          height={message.mediaHeight}
          onOpen={onOpenImage}
        />
      )
    }

    case 'video':
      return (
        <LazyVideoMessage
          uri={message.mediaUri}
          previewUri={message.mediaPreviewUri}
          mediaWidth={message.mediaWidth}
          mediaHeight={message.mediaHeight}
        />
      )

    case 'audio':
      return (
        <AudioPlayer
          message={message}
          showMeta={message.text === null || message.text.trim().length === 0}
        />
      )

    default:
      return null
  }
})

const UnavailableMedia = memo(function UnavailableMedia({
  message,
  textScale
}: {
  message: Message
  textScale: number
}) {
  return (
    <View className='min-h-24 w-[240px] flex-row items-center rounded-lg bg-black/15 px-3 py-3'>
      <View className='size-12 items-center justify-center rounded-lg bg-black/20'>
        <Ionicons name={getMediaIcon(message.mediaType)} size={25} color='#AEBAC1' />
      </View>
      <View className='ml-3 min-w-0 flex-1'>
        <Text className='text-wa-text-primary font-medium' style={{ fontSize: 14 * textScale }}>
          Media unavailable
        </Text>
        <Text className='text-wa-text-secondary mt-0.5' style={{ fontSize: 11.5 * textScale }}>
          Not included in this export
        </Text>
      </View>
    </View>
  )
})

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
  previewUri: string | null
  width: number | null
  height: number | null
  onOpen?: () => void
}

const ChatImage = memo(function ChatImage({
  uri,
  previewUri,
  width,
  height,
  onOpen
}: ChatImageProps) {
  const { width: screenWidth } = useWindowDimensions()
  const { width: previewWidth, height: previewHeight } = getChatMediaPreviewSize(
    screenWidth,
    width,
    height
  )

  return (
    <Pressable accessibilityLabel='Open image' accessibilityRole='button' onPress={onOpen}>
      <Image
        source={{ uri: previewUri ?? uri }}
        recyclingKey={previewUri ?? uri}
        className='rounded-lg object-cover'
        style={{ width: previewWidth, height: previewHeight }}
      />
    </Pressable>
  )
})

const DocumentMessage = memo(function DocumentMessage({
  message,
  textScale
}: {
  message: Message
  textScale: number
}) {
  const [busyAction, setBusyAction] = useRecyclingState<'open' | 'share' | null>(null, [message.id])
  const uriFilename = message.mediaUri?.split('/').pop()?.split(/[?#]/)[0] ?? null
  const filename = getDecodedFilename(message.mediaFilename ?? uriFilename, 'Document')
  const presentation = getDocumentPresentation(filename)
  const available = message.mediaUri !== null
  const target = useMemo(
    () => ({
      uri: message.mediaUri,
      filename,
      mimeType: presentation?.mimeType ?? 'application/octet-stream'
    }),
    [filename, message.mediaUri, presentation?.mimeType]
  )

  const runAction = useCallback(
    async (action: 'open' | 'share') => {
      if (busyAction) return
      if (!available) {
        Alert.alert('File unavailable', 'The original document is missing from this archive.')
        return
      }
      if (!presentation) {
        Alert.alert('Unsupported document', 'This file type has no safe platform handler.')
        return
      }

      setBusyAction(action)
      try {
        if (action === 'open') await openLocalFile(target)
        else await shareLocalFile(target)
      } catch (error) {
        Alert.alert(
          action === 'open' ? 'Could not open document' : 'Could not share document',
          error instanceof MediaFileActionError ? error.message : 'An unexpected error occurred.'
        )
      } finally {
        setBusyAction(null)
      }
    },
    [available, busyAction, presentation, setBusyAction, target]
  )

  return (
    <View className='max-w-[280px] min-w-[245px] px-1 py-1'>
      <Pressable
        accessibilityLabel={`Open ${filename}`}
        accessibilityRole='button'
        className='flex-row items-center rounded-lg bg-black/10 px-2.5 py-2.5 active:bg-black/20'
        onPress={() => void runAction('open')}
      >
        <View className='bg-wa-accent/20 size-11 items-center justify-center rounded-lg'>
          <Ionicons
            name={available ? 'document-text' : 'cloud-offline-outline'}
            size={23}
            color={available ? '#00A884' : '#8696A0'}
          />
        </View>
        <View className='ml-3 min-w-0 flex-1 pr-1'>
          <Text
            className='text-wa-text-primary font-medium'
            numberOfLines={2}
            style={{ fontSize: 13 * textScale }}
          >
            {filename}
          </Text>
          <Text
            className='text-wa-text-secondary mt-1'
            numberOfLines={1}
            style={{ fontSize: 10.5 * textScale }}
          >
            {presentation?.label ?? 'Unsupported'} · {formatFileSize(message.mediaSize)}
            {!available ? ' · Missing' : ''}
          </Text>
        </View>
        <Ionicons name='open-outline' size={18} color={available ? '#AEBAC1' : '#667781'} />
      </Pressable>

      <View className='mt-1 flex-row justify-end'>
        <Pressable
          accessibilityLabel={`Share ${filename}`}
          accessibilityRole='button'
          className='min-h-11 flex-row items-center rounded-full px-3 active:bg-black/15'
          onPress={event => {
            event.stopPropagation()
            void runAction('share')
          }}
        >
          <Ionicons name='share-outline' size={17} color='#AEBAC1' />
          <Text className='text-wa-text-secondary ml-1.5' style={{ fontSize: 11 * textScale }}>
            {busyAction === 'share' ? 'Opening…' : 'Share'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
})

// Only create the native video player when the user taps play
interface LazyVideoMessageProps {
  uri: string
  previewUri: string | null
  mediaWidth: number | null
  mediaHeight: number | null
}

const LazyVideoMessage = memo(function LazyVideoMessage({
  uri,
  previewUri,
  mediaWidth,
  mediaHeight
}: LazyVideoMessageProps) {
  const [activated, setActivated] = useRecyclingState(false, [uri])
  const { width: screenWidth } = useWindowDimensions()
  const { width: previewWidth, height: previewHeight } = getChatVideoPreviewSize(
    screenWidth,
    mediaWidth,
    mediaHeight
  )

  if (!activated) {
    return (
      <Pressable
        accessibilityLabel='Play video'
        accessibilityRole='button'
        className='items-center justify-center overflow-hidden rounded-lg bg-black'
        style={{ width: previewWidth, height: previewHeight }}
        onPress={() => setActivated(true)}
      >
        {previewUri ? (
          <Image
            source={{ uri: previewUri }}
            recyclingKey={previewUri}
            className='absolute inset-0 object-contain'
            style={{ width: previewWidth, height: previewHeight }}
          />
        ) : (
          <VideoPoster uri={uri} width={previewWidth} height={previewHeight} />
        )}
        <View className='size-14 items-center justify-center rounded-full bg-white/20'>
          <Ionicons name='play' size={32} color='#FFFFFF' />
        </View>
      </Pressable>
    )
  }

  return <ActiveVideoPlayer uri={uri} width={previewWidth} height={previewHeight} />
})

const VideoPoster = memo(function VideoPoster({
  uri,
  width,
  height
}: {
  uri: string
  width: number
  height: number
}) {
  const player = useVideoPlayer(uri, instance => {
    instance.muted = true
  })

  return (
    <VideoView
      player={player}
      style={{ position: 'absolute', width, height }}
      contentFit='contain'
      nativeControls={false}
      pointerEvents='none'
    />
  )
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
        contentFit='contain'
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
