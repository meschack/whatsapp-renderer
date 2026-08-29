import { Ionicons } from '@expo/vector-icons'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { File } from 'expo-file-system'
import { useVideoPlayer, VideoView } from 'expo-video'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  type ViewToken,
  useWindowDimensions
} from 'react-native'
import { Pressable, Text, View } from '@/src/tw'
import { MediaFileActionError, saveMediaFile, shareMediaFile } from '@/utils/media-file-actions'
import { getSafeMediaFilename } from '@/utils/media-file'
import type { AttachmentRecord } from '@/utils/media-library'

interface MediaViewerProps {
  title?: string
  records: AttachmentRecord[]
  initialSequence: number
  hasOlder: boolean
  hasNewer: boolean
  loadOlder(): Promise<AttachmentRecord[] | void>
  loadNewer(): Promise<AttachmentRecord[] | void>
  onClose(): void
  onJump(record: AttachmentRecord): void
}

export function MediaViewer({
  title,
  records,
  initialSequence,
  hasOlder,
  hasNewer,
  loadOlder,
  loadNewer,
  onClose,
  onJump
}: MediaViewerProps) {
  const [sequence, setSequence] = useState(initialSequence)
  const [isSaving, setIsSaving] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const listRef = useRef<FlashListRef<AttachmentRecord>>(null)
  const activeSequenceRef = useRef(initialSequence)
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const record = records.find(item => item.sequence === sequence) ?? null
  const index = records.findIndex(item => item.sequence === sequence)
  const initialIndex = Math.max(
    0,
    records.findIndex(item => item.sequence === initialSequence)
  )

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => subscription.remove()
  }, [onClose])

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<AttachmentRecord>[] }) => {
      const visible = viewableItems.find(token => token.isViewable)?.item
      if (visible) {
        activeSequenceRef.current = visible.sequence
        setSequence(visible.sequence)
      }
    }
  ).current

  useEffect(() => {
    const nextIndex = records.findIndex(item => item.sequence === activeSequenceRef.current)
    if (nextIndex < 0) return
    listRef.current?.scrollToIndex({ index: nextIndex, animated: false })
  }, [records])

  const runSave = useCallback(async () => {
    if (!record || isSaving) return
    setIsSaving(true)
    try {
      const result = await saveMediaFile(record)
      if (result === 'saved') Alert.alert('Saved', 'The media was copied to the selected folder.')
    } catch (error) {
      Alert.alert(
        'Could not save media',
        error instanceof MediaFileActionError ? error.message : 'An unexpected error occurred.'
      )
    } finally {
      setIsSaving(false)
    }
  }, [isSaving, record])

  const runShare = useCallback(async () => {
    if (!record || isSharing) return
    setIsSharing(true)
    try {
      await shareMediaFile(record)
    } catch (error) {
      Alert.alert(
        'Could not share media',
        error instanceof MediaFileActionError ? error.message : 'An unexpected error occurred.'
      )
    } finally {
      setIsSharing(false)
    }
  }, [isSharing, record])

  return (
    <View className='absolute inset-0 z-50 bg-black'>
      <View className='absolute top-0 right-0 left-0 z-10 flex-row items-center bg-black/75 px-2 pt-3 pb-2'>
        <Pressable
          accessibilityLabel='Close media viewer'
          className='size-11 items-center justify-center'
          onPress={onClose}
        >
          <Ionicons name='close' size={28} color='#FFFFFF' />
        </Pressable>
        <View className='ml-1 flex-1'>
          <Text className='text-[14px] font-medium text-white' numberOfLines={1}>
            {title ?? (record ? getSafeMediaFilename(record) : 'Media unavailable')}
          </Text>
          <Text className='text-[11px] text-white/60' numberOfLines={1}>
            {record
              ? `${record.sender ?? 'System'} · ${record.timestamp.toLocaleString()}`
              : 'The selected item is no longer loaded'}
          </Text>
        </View>
        <Text className='mr-2 text-[11px] text-white/60'>
          {index >= 0 ? `${index + 1}/${records.length}` : ''}
        </Text>
      </View>

      <FlashList
        ref={listRef}
        horizontal
        pagingEnabled
        data={records}
        initialScrollIndex={initialIndex}
        keyExtractor={item => item.messageId}
        renderItem={({ item }) => (
          <MediaSlide record={item} width={screenWidth} height={screenHeight} />
        )}
        showsHorizontalScrollIndicator={false}
        maintainVisibleContentPosition={{
          animateAutoScrollToBottom: false
        }}
        onViewableItemsChanged={handleViewableItemsChanged}
        onStartReached={() => {
          if (hasNewer) void loadNewer()
        }}
        onStartReachedThreshold={0.4}
        onEndReached={() => {
          if (hasOlder) void loadOlder()
        }}
        onEndReachedThreshold={0.4}
      />

      <View className='absolute right-0 bottom-0 left-0 z-10 flex-row items-center justify-around bg-black/75 px-3 pt-2 pb-4'>
        <ViewerAction
          label='Save'
          icon='download-outline'
          busy={isSaving}
          onPress={() => void runSave()}
        />
        <ViewerAction
          label='Share'
          icon='share-outline'
          busy={isSharing}
          onPress={() => void runShare()}
        />
        <ViewerAction
          label='Message'
          icon='chatbubble-ellipses-outline'
          onPress={() => record && onJump(record)}
        />
      </View>
    </View>
  )
}

const MediaSlide = memo(function MediaSlide({
  record,
  width,
  height
}: {
  record: AttachmentRecord
  width: number
  height: number
}) {
  const mediaAvailable = useMemo(() => {
    if (!record.mediaUri) return false
    try {
      return new File(record.mediaUri).exists
    } catch {
      return false
    }
  }, [record.mediaUri])

  return (
    <View style={{ width, height }} className='items-center justify-center'>
      {record.mediaUri && mediaAvailable ? (
        record.type === 'video' ? (
          <FullscreenVideo uri={record.mediaUri} />
        ) : (
          <Image
            source={{ uri: record.mediaUri }}
            recyclingKey={`viewer-${record.mediaUri}`}
            contentFit='contain'
            style={{ width, height }}
          />
        )
      ) : (
        <View className='items-center px-8'>
          <Ionicons name='cloud-offline-outline' size={48} color='#8696A0' />
          <Text className='mt-3 text-center text-sm text-white/60'>
            The original media file is missing.
          </Text>
        </View>
      )}
    </View>
  )
})

function FullscreenVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri)
  const { width, height } = useWindowDimensions()

  useEffect(() => {
    player.play()
    return () => player.pause()
  }, [player])

  return <VideoView player={player} style={{ width, height }} contentFit='contain' nativeControls />
}

function ViewerAction({
  label,
  icon,
  busy = false,
  onPress
}: {
  label: string
  icon: keyof typeof Ionicons.glyphMap
  busy?: boolean
  onPress(): void
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      className='min-w-20 items-center justify-center py-1'
      disabled={busy}
      onPress={onPress}
    >
      {busy ? (
        <ActivityIndicator size='small' color='#FFFFFF' />
      ) : (
        <Ionicons name={icon} size={22} color='#FFFFFF' />
      )}
      <Text className='mt-1 text-[11px] text-white'>{label}</Text>
    </Pressable>
  )
}
