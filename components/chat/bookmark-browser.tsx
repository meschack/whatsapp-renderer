import { Ionicons } from '@expo/vector-icons'
import { FlashList } from '@shopify/flash-list'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator } from 'react-native'

import { Pressable, Text, View } from '@/src/tw'
import { getBookmarkPage } from '@/store/message-database'
import type { BookmarkCursor, BookmarkRecord } from '@/utils/bookmarks'

const BOOKMARK_PAGE_SIZE = 40

interface BookmarkBrowserProps {
  chatId: string
  onClose(): void
  onJump(record: BookmarkRecord): void
}

export function BookmarkBrowser({ chatId, onClose, onJump }: BookmarkBrowserProps) {
  const [records, setRecords] = useState<BookmarkRecord[]>([])
  const [cursor, setCursor] = useState<BookmarkCursor | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const generationRef = useRef(0)
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    const generation = ++generationRef.current
    setRecords([])
    setCursor(null)
    setHasMore(false)
    setIsInitialLoading(true)

    void getBookmarkPage(chatId, null, BOOKMARK_PAGE_SIZE).then(
      page => {
        if (generationRef.current !== generation) return
        setRecords(page.records)
        setCursor(page.nextCursor)
        setHasMore(page.hasMore)
        setIsInitialLoading(false)
      },
      error => {
        if (generationRef.current !== generation) return
        console.error('Failed to load bookmarks', error)
        setIsInitialLoading(false)
      }
    )

    return () => {
      if (generationRef.current === generation) generationRef.current += 1
    }
  }, [chatId])

  const loadMore = useCallback(() => {
    if (!hasMore || !cursor || loadingMoreRef.current) return
    loadingMoreRef.current = true
    setIsLoadingMore(true)
    const generation = generationRef.current

    void getBookmarkPage(chatId, cursor, BOOKMARK_PAGE_SIZE)
      .then(
        page => {
          if (generationRef.current !== generation) return
          setRecords(current => {
            const existing = new Set(current.map(record => record.sequence))
            return [...current, ...page.records.filter(record => !existing.has(record.sequence))]
          })
          setCursor(page.nextCursor)
          setHasMore(page.hasMore)
        },
        error => console.error('Failed to load more bookmarks', error)
      )
      .finally(() => {
        if (generationRef.current === generation) setIsLoadingMore(false)
        loadingMoreRef.current = false
      })
  }, [chatId, cursor, hasMore])

  const renderItem = useCallback(
    ({ item }: { item: BookmarkRecord }) => (
      <BookmarkRow record={item} onPress={() => onJump(item)} />
    ),
    [onJump]
  )

  return (
    <View className='flex-1 bg-[#0B141A]'>
      <View className='flex-row items-center border-b border-white/5 bg-[#202C33] px-2 py-1'>
        <Pressable
          accessibilityLabel='Close bookmarks'
          className='size-11 items-center justify-center rounded-full active:bg-white/10'
          onPress={onClose}
        >
          <Ionicons name='arrow-back' size={24} color='#E9EDEF' />
        </Pressable>
        <Text className='ml-1 text-[17px] font-medium text-[#E9EDEF]'>Bookmarks</Text>
      </View>

      {isInitialLoading ? (
        <View className='flex-1 items-center justify-center'>
          <ActivityIndicator color='#00A884' />
        </View>
      ) : (
        <FlashList
          data={records}
          renderItem={renderItem}
          keyExtractor={item => item.messageId}
          contentContainerStyle={{ padding: 8 }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          ListEmptyComponent={
            <View className='items-center justify-center px-8 py-28'>
              <Ionicons name='bookmark-outline' size={42} color='#667781' />
              <Text className='mt-3 text-center text-sm text-[#8696A0]'>
                Long-press a message to bookmark it
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View className='items-center py-5'>
                <ActivityIndicator size='small' color='#00A884' />
              </View>
            ) : null
          }
        />
      )}
    </View>
  )
}

const BookmarkRow = memo(function BookmarkRow({
  record,
  onPress
}: {
  record: BookmarkRecord
  onPress(): void
}) {
  const time = record.timestamp.toLocaleString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  const icon = record.mediaType ? MEDIA_ICONS[record.mediaType] : 'chatbubble-outline'

  return (
    <Pressable
      accessibilityLabel={`${record.sender ?? 'System'}, ${record.excerpt}, ${time}`}
      accessibilityHint='Jump to bookmarked message'
      accessibilityRole='button'
      className='mb-2 flex-row items-start rounded-xl bg-[#202C33] px-3 py-3 active:bg-[#2A3942]'
      onPress={onPress}
    >
      <View className='size-10 items-center justify-center rounded-full bg-[#00A884]/15'>
        <Ionicons name={icon} size={20} color='#00C896' />
      </View>
      <View className='ml-3 flex-1'>
        <View className='flex-row items-center justify-between gap-3'>
          <Text className='flex-1 text-[13px] font-medium text-[#00A884]' numberOfLines={1}>
            {record.sender ?? 'System'}
          </Text>
          <Text className='text-[10.5px] text-[#8696A0]'>{time}</Text>
        </View>
        <Text className='mt-1 text-[13px] leading-5 text-[#D1D7DB]' numberOfLines={3}>
          {record.excerpt}
        </Text>
        {record.mediaType && (
          <Text className='mt-1 text-[10px] tracking-wide text-[#8696A0] uppercase'>
            {record.mediaType}
          </Text>
        )}
      </View>
      <Ionicons name='chevron-forward' size={17} color='#667781' />
    </Pressable>
  )
})

const MEDIA_ICONS: Record<
  NonNullable<BookmarkRecord['mediaType']>,
  keyof typeof Ionicons.glyphMap
> = {
  image: 'image-outline',
  video: 'videocam-outline',
  audio: 'mic-outline',
  document: 'document-text-outline'
}
