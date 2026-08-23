import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { File } from 'expo-file-system'
import { Image } from 'expo-image'
import { memo, useCallback, useMemo, useState } from 'react'
import { ActivityIndicator, Linking, ScrollView } from 'react-native'

import { useAttachmentPages } from '@/hooks/use-attachment-pages'
import { Pressable, Text, View } from '@/src/tw'
import type { AttachmentFilter, AttachmentRecord } from '@/utils/media-library'
import { MediaViewer } from './media-viewer'

const FILTERS: { id: AttachmentFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'image', label: 'Photos', icon: 'image-outline' },
  { id: 'video', label: 'Videos', icon: 'videocam-outline' },
  { id: 'audio', label: 'Audio', icon: 'mic-outline' },
  { id: 'link', label: 'Links', icon: 'link-outline' },
  { id: 'document', label: 'Docs', icon: 'document-outline' }
]

const EMPTY_LABELS: Record<AttachmentFilter, string> = {
  image: 'No photos in this chat',
  video: 'No videos in this chat',
  audio: 'No audio in this chat',
  link: 'No links in this chat',
  document: 'No documents in this chat'
}

interface MediaLibraryProps {
  chatId: string
  onClose(): void
  onJump(record: AttachmentRecord): void
}

export function MediaLibrary({ chatId, onClose, onJump }: MediaLibraryProps) {
  const [filter, setFilter] = useState<AttachmentFilter>('image')
  const [viewerSequence, setViewerSequence] = useState<number | null>(null)
  const {
    records,
    hasOlder,
    hasNewer,
    isInitialLoading,
    isLoadingOlder,
    isLoadingNewer,
    loadOlder,
    loadNewer
  } = useAttachmentPages(chatId, filter)
  const isGrid = filter === 'image' || filter === 'video'

  const renderItem = useCallback(
    ({ item }: { item: AttachmentRecord }) => (
      <AttachmentTile
        record={item}
        grid={isGrid}
        onOpen={() => (isGrid ? setViewerSequence(item.sequence) : onJump(item))}
      />
    ),
    [isGrid, onJump]
  )

  return (
    <View className='flex-1 bg-[#0B141A]'>
      <View className='flex-row items-center border-b border-white/5 bg-[#202C33] px-2 py-1'>
        <Pressable
          accessibilityLabel='Close media library'
          className='size-11 items-center justify-center rounded-full active:bg-white/10'
          onPress={onClose}
        >
          <Ionicons name='arrow-back' size={24} color='#E9EDEF' />
        </Pressable>
        <Text className='ml-1 text-[17px] font-medium text-[#E9EDEF]'>Chat media</Text>
      </View>

      <View className='border-b border-white/5 bg-[#111B21] py-2'>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 10, gap: 7 }}
        >
          {FILTERS.map(item => {
            const selected = item.id === filter
            return (
              <Pressable
                key={item.id}
                className={`flex-row items-center rounded-full border px-3 py-2 ${
                  selected ? 'border-[#00A884] bg-[#00A884]/15' : 'border-white/10 bg-[#202C33]'
                }`}
                onPress={() => setFilter(item.id)}
              >
                <Ionicons name={item.icon} size={16} color={selected ? '#00C896' : '#AEBAC1'} />
                <Text
                  className={`ml-1.5 text-[12px] ${selected ? 'text-[#00C896]' : 'text-[#D1D7DB]'}`}
                >
                  {item.label}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {isInitialLoading ? (
        <View className='flex-1 items-center justify-center'>
          <ActivityIndicator color='#00A884' />
        </View>
      ) : (
        <FlashList
          key={filter}
          data={records}
          numColumns={isGrid ? 3 : 1}
          renderItem={renderItem}
          keyExtractor={item => `${filter}-${item.sequence}`}
          contentContainerStyle={{ padding: isGrid ? 2 : 8 }}
          maintainVisibleContentPosition={{
            autoscrollToTopThreshold: 0.1,
            animateAutoScrollToBottom: false
          }}
          onStartReached={() => {
            if (hasNewer && !isLoadingNewer) void loadNewer()
          }}
          onStartReachedThreshold={0.2}
          onEndReached={() => {
            if (hasOlder && !isLoadingOlder) void loadOlder()
          }}
          onEndReachedThreshold={0.35}
          ListHeaderComponent={
            isLoadingNewer ? (
              <View className='items-center py-3'>
                <ActivityIndicator size='small' color='#00A884' />
              </View>
            ) : null
          }
          ListFooterComponent={
            isLoadingOlder ? (
              <View className='items-center py-5'>
                <ActivityIndicator size='small' color='#00A884' />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className='flex-1 items-center justify-center px-8 py-24'>
              <Ionicons
                name={FILTERS.find(item => item.id === filter)!.icon}
                size={40}
                color='#667781'
              />
              <Text className='mt-3 text-center text-sm text-[#8696A0]'>
                {EMPTY_LABELS[filter]}
              </Text>
            </View>
          }
        />
      )}
      {viewerSequence !== null && (
        <MediaViewer
          records={records}
          initialSequence={viewerSequence}
          hasOlder={hasOlder}
          hasNewer={hasNewer}
          loadOlder={loadOlder}
          loadNewer={loadNewer}
          onClose={() => setViewerSequence(null)}
          onJump={record => {
            setViewerSequence(null)
            onJump(record)
          }}
        />
      )}
    </View>
  )
}

const AttachmentTile = memo(function AttachmentTile({
  record,
  grid,
  onOpen
}: {
  record: AttachmentRecord
  grid: boolean
  onOpen(): void
}) {
  const available = useMemo(() => {
    if (record.type === 'link') return record.url !== null
    if (!record.mediaUri) return false
    try {
      return new File(record.mediaUri).exists
    } catch {
      return false
    }
  }, [record.mediaUri, record.type, record.url])
  const previewAvailable = useMemo(() => {
    if (!record.previewUri) return false
    try {
      return new File(record.previewUri).exists
    } catch {
      return false
    }
  }, [record.previewUri])

  if (grid) {
    return (
      <Pressable
        accessibilityLabel={`Open ${record.type} ${record.filename ?? ''}`.trim()}
        accessibilityRole='button'
        className='m-px aspect-square flex-1 overflow-hidden bg-[#202C33]'
        onPress={onOpen}
      >
        {previewAvailable ? (
          <Image
            source={{ uri: record.previewUri! }}
            style={{ width: '100%', height: '100%' }}
            contentFit='cover'
          />
        ) : (
          <View className='flex-1 items-center justify-center px-2'>
            <Ionicons
              name={available ? 'image-outline' : 'cloud-offline-outline'}
              size={27}
              color='#8696A0'
            />
            <Text className='mt-1 text-center text-[10px] text-[#AEBAC1]' numberOfLines={2}>
              {record.filename ?? (available ? 'No preview' : 'Missing file')}
            </Text>
          </View>
        )}
        {record.type === 'video' && (
          <View className='absolute inset-0 items-center justify-center'>
            <View className='size-9 items-center justify-center rounded-full bg-black/60'>
              <Ionicons name='play' size={19} color='#FFFFFF' />
            </View>
          </View>
        )}
        {!available && (
          <View className='absolute right-1 bottom-1 rounded bg-black/70 px-1.5 py-0.5'>
            <Text className='text-[9px] text-white'>Missing</Text>
          </View>
        )}
      </Pressable>
    )
  }

  const icon =
    record.type === 'audio'
      ? 'mic-outline'
      : record.type === 'document'
        ? 'document-text-outline'
        : 'link-outline'
  const title =
    record.type === 'link'
      ? (record.url ?? 'Unavailable link')
      : (record.filename ?? (record.type === 'audio' ? 'Audio message' : 'Document'))

  return (
    <Pressable
      accessibilityLabel={`${title}, ${formatAttachmentDetails(record)}`}
      accessibilityHint='Jump to source message'
      accessibilityRole='button'
      className='mb-2 flex-row items-center rounded-xl bg-[#202C33] px-3 py-3 active:bg-[#2A3942]'
      onPress={onOpen}
    >
      <View className='size-11 items-center justify-center rounded-full bg-[#00A884]/15'>
        <Ionicons
          name={available ? icon : 'cloud-offline-outline'}
          size={22}
          color={available ? '#00C896' : '#8696A0'}
        />
      </View>
      <View className='ml-3 flex-1'>
        <Text className='text-[14px] font-medium text-[#E9EDEF]' numberOfLines={1}>
          {title}
        </Text>
        <Text className='mt-0.5 text-[11px] text-[#8696A0]' numberOfLines={1}>
          {available ? formatAttachmentDetails(record) : 'Missing · tap to find the source message'}
        </Text>
      </View>
      {record.type === 'link' && available && (
        <Pressable
          accessibilityLabel='Open link'
          accessibilityRole='link'
          className='ml-2 size-11 items-center justify-center rounded-full bg-white/5'
          onPress={event => {
            event.stopPropagation()
            void Linking.openURL(record.url!).catch(() => undefined)
          }}
        >
          <Ionicons name='open-outline' size={18} color='#AEBAC1' />
        </Pressable>
      )}
      <Ionicons name='chatbubble-outline' size={18} color='#8696A0' />
    </Pressable>
  )
})

function formatAttachmentDetails(record: AttachmentRecord): string {
  const date = record.timestamp.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
  if (record.type === 'link') return `${record.sender ?? 'Unknown'} · ${date}`
  if (record.duration !== null) {
    const minutes = Math.floor(record.duration / 60)
    const seconds = Math.floor(record.duration % 60)
      .toString()
      .padStart(2, '0')
    return `${minutes}:${seconds} · ${date}`
  }
  if (record.size !== null) return `${formatBytes(record.size)} · ${date}`
  return date
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}
