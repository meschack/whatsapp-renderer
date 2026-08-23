import type { Message } from '@/models/types'
import { Pressable, Text, View } from '@/src/tw'
import { Image } from '@/src/tw/image'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { memo, useCallback, useMemo } from 'react'
import { Alert, Modal, useWindowDimensions } from 'react-native'
import { AudioPlayer } from './audio-player'
import { useRecyclingState } from '@shopify/flash-list'
import { MediaFileActionError, openLocalFile, shareLocalFile } from '@/utils/media-file-actions'
import { formatFileSize, getDecodedFilename, getDocumentPresentation } from '@/utils/media-file'

interface MediaMessageProps {
  message: Message
}

export const MediaMessage = memo(function MediaMessage({ message }: MediaMessageProps) {
  const [imageModalVisible, setImageModalVisible] = useRecyclingState(false, [message.id])

  if (!message.mediaType) return null

  if (message.mediaType === 'document') return <DocumentMessage message={message} />

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
          previewUri={message.mediaPreviewUri}
          width={message.mediaWidth}
          height={message.mediaHeight}
          isModalVisible={imageModalVisible}
          onOpenModal={() => setImageModalVisible(true)}
          onCloseModal={() => setImageModalVisible(false)}
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
  previewUri: string | null
  width: number | null
  height: number | null
  isModalVisible: boolean
  onOpenModal: () => void
  onCloseModal: () => void
}

const ChatImage = memo(function ChatImage({
  uri,
  previewUri,
  width,
  height,
  isModalVisible,
  onOpenModal,
  onCloseModal
}: ChatImageProps) {
  const { width: screenWidth } = useWindowDimensions()
  const previewWidth = Math.min(MEDIA_MAX_WIDTH, screenWidth * 0.78)
  const previewHeight = getPreviewHeight(previewWidth, width, height)

  return (
    <>
      <Pressable onPress={onOpenModal}>
        <Image
          source={{ uri: previewUri ?? uri }}
          recyclingKey={previewUri ?? uri}
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

const DocumentMessage = memo(function DocumentMessage({ message }: { message: Message }) {
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
          <Text className='text-wa-text-primary text-[13px] font-medium' numberOfLines={2}>
            {filename}
          </Text>
          <Text className='text-wa-text-secondary mt-1 text-[10.5px]' numberOfLines={1}>
            {presentation?.label ?? 'Unsupported'} · {formatFileSize(message.mediaSize)}
            {!available ? ' · Missing' : ''}
          </Text>
        </View>
        <Ionicons name='open-outline' size={18} color={available ? '#AEBAC1' : '#667781'} />
      </Pressable>

      <View className='mt-1 flex-row justify-end'>
        <Pressable
          accessibilityLabel={`Share ${filename}`}
          className='min-h-10 flex-row items-center rounded-full px-3 active:bg-black/15'
          onPress={event => {
            event.stopPropagation()
            void runAction('share')
          }}
        >
          <Ionicons name='share-outline' size={17} color='#AEBAC1' />
          <Text className='text-wa-text-secondary ml-1.5 text-[11px]'>
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
  const previewWidth = Math.min(MEDIA_MAX_WIDTH, screenWidth * 0.78)
  const previewHeight = getPreviewHeight(previewWidth, mediaWidth, mediaHeight)

  if (!activated) {
    return (
      <Pressable
        className='items-center justify-center overflow-hidden rounded-lg bg-black/50'
        style={{ width: previewWidth, height: previewHeight }}
        onPress={() => setActivated(true)}
      >
        {previewUri && (
          <Image
            source={{ uri: previewUri }}
            recyclingKey={previewUri}
            className='absolute inset-0 object-cover'
            style={{ width: previewWidth, height: previewHeight }}
          />
        )}
        <View className='size-14 items-center justify-center rounded-full bg-white/20'>
          <Ionicons name='play' size={32} color='#FFFFFF' />
        </View>
      </Pressable>
    )
  }

  return <ActiveVideoPlayer uri={uri} width={previewWidth} height={previewHeight} />
})

function getPreviewHeight(width: number, mediaWidth: number | null, mediaHeight: number | null) {
  if (!mediaWidth || !mediaHeight) return width / MEDIA_ASPECT_RATIO
  return Math.min(width * 1.25, Math.max(120, width * (mediaHeight / mediaWidth)))
}

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
