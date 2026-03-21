import { useState } from 'react'
import { Modal } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useVideoPlayer, VideoView } from 'expo-video'
import { View, Text, Pressable } from '@/src/tw'
import { Image } from '@/src/tw/image'
import { AudioPlayer } from './AudioPlayer'
import type { Message } from '@/models/types'

interface MediaMessageProps {
  message: Message
}

export function MediaMessage({ message }: MediaMessageProps) {
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
        <Text className={`text-sm italic ${message.isMine ? 'text-white/70' : 'text-wa-text-secondary'}`}>
          {getMediaLabel(message.mediaType)}
        </Text>
      </View>
    )
  }

  switch (message.mediaType) {
    case 'image':
      return (
        <>
          <Pressable onPress={() => setImageModalVisible(true)}>
            <Image className='w-[250px] h-[250px] rounded-lg object-cover' source={{ uri: message.mediaUri }} />
          </Pressable>
          <Modal visible={imageModalVisible} transparent animationType='fade' onRequestClose={() => setImageModalVisible(false)}>
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}
              onPress={() => setImageModalVisible(false)}
            >
              <Image className='w-full h-[80%] object-contain' source={{ uri: message.mediaUri }} />
            </Pressable>
          </Modal>
        </>
      )

    case 'video':
      return <VideoMessage uri={message.mediaUri} />

    case 'audio':
      return <AudioPlayer uri={message.mediaUri} isMine={message.isMine} />

    case 'document':
      return (
        <View className='flex-row items-center gap-3 py-2 px-1'>
          <View className='w-10 h-10 rounded-lg bg-wa-accent/20 justify-center items-center'>
            <Ionicons name='document' size={22} color='#00A884' />
          </View>
          <View className='flex-1'>
            <Text className='text-sm text-wa-text-primary' numberOfLines={1}>
              {message.mediaUri.split('/').pop() ?? 'Document'}
            </Text>
            <Text className='text-[11px] text-wa-text-secondary'>Document</Text>
          </View>
        </View>
      )

    default:
      return null
  }
}

function VideoMessage({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri)

  return (
    <View className='w-[250px] h-[250px] rounded-lg overflow-hidden'>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit='cover' nativeControls />
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
