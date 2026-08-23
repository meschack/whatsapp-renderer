import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { File } from 'expo-file-system'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, Modal, useWindowDimensions } from 'react-native'
import { Pressable, Text, View } from '@/src/tw'
import { MediaFileActionError, saveMediaFile, shareMediaFile } from '@/utils/media-file-actions'
import { getAdjacentMediaSequence, getSafeMediaFilename } from '@/utils/media-file'
import type { AttachmentRecord } from '@/utils/media-library'

interface MediaViewerProps {
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
  const [pendingDirection, setPendingDirection] = useState<'newer' | 'older' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const record = records.find(item => item.sequence === sequence) ?? null
  const index = records.findIndex(item => item.sequence === sequence)
  const mediaAvailable = useMemo(() => {
    if (!record?.mediaUri) return false
    try {
      return new File(record.mediaUri).exists
    } catch {
      return false
    }
  }, [record?.mediaUri])

  const navigate = useCallback(
    async (direction: 'newer' | 'older') => {
      const adjacent = getAdjacentMediaSequence(records, sequence, direction)
      if (adjacent !== null) {
        setSequence(adjacent)
        return
      }

      const canLoad = direction === 'newer' ? hasNewer : hasOlder
      if (!canLoad || pendingDirection) return
      setPendingDirection(direction)
      try {
        const loadedRecords = direction === 'newer' ? await loadNewer() : await loadOlder()
        const loadedAdjacent = getAdjacentMediaSequence(
          loadedRecords ?? records,
          sequence,
          direction
        )
        if (loadedAdjacent !== null) setSequence(loadedAdjacent)
      } finally {
        setPendingDirection(null)
      }
    },
    [hasNewer, hasOlder, loadNewer, loadOlder, pendingDirection, records, sequence]
  )

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

  const canNavigateNewer = index > 0 || hasNewer
  const canNavigateOlder = (index >= 0 && index < records.length - 1) || hasOlder

  return (
    <Modal visible animationType='fade' statusBarTranslucent onRequestClose={onClose}>
      <View className='flex-1 bg-black'>
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
              {record ? getSafeMediaFilename(record) : 'Media unavailable'}
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

        <View className='flex-1 items-center justify-center'>
          {record?.mediaUri && mediaAvailable ? (
            record.type === 'video' ? (
              <FullscreenVideo key={record.mediaUri} uri={record.mediaUri} />
            ) : (
              <Image
                key={record.mediaUri}
                source={{ uri: record.mediaUri }}
                recyclingKey={`viewer-${record.mediaUri}`}
                contentFit='contain'
                style={{ width: '100%', height: '100%' }}
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

        <Pressable
          accessibilityLabel='Newer media'
          accessibilityState={{ disabled: !canNavigateNewer }}
          className='absolute top-1/2 left-2 size-11 items-center justify-center rounded-full bg-black/55'
          disabled={!canNavigateNewer}
          onPress={() => void navigate('newer')}
        >
          {pendingDirection === 'newer' ? (
            <ActivityIndicator size='small' color='#FFFFFF' />
          ) : (
            <Ionicons
              name='chevron-back'
              size={28}
              color={canNavigateNewer ? '#FFFFFF' : '#3B4A54'}
            />
          )}
        </Pressable>
        <Pressable
          accessibilityLabel='Older media'
          accessibilityState={{ disabled: !canNavigateOlder }}
          className='absolute top-1/2 right-2 size-11 items-center justify-center rounded-full bg-black/55'
          disabled={!canNavigateOlder}
          onPress={() => void navigate('older')}
        >
          {pendingDirection === 'older' ? (
            <ActivityIndicator size='small' color='#FFFFFF' />
          ) : (
            <Ionicons
              name='chevron-forward'
              size={28}
              color={canNavigateOlder ? '#FFFFFF' : '#3B4A54'}
            />
          )}
        </Pressable>

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
    </Modal>
  )
}

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
