import { useToolFocus } from '@/hooks/use-tool-focus'
import { LoadError } from '@/components/shared/load-error'
import { useAppAppearance } from '@/components/settings/app-appearance-provider'
import { ThemedIonicons as Ionicons } from '@/components/shared/themed-icon'
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
  const { colors } = useAppAppearance()
  const [records, setRecords] = useState<BookmarkRecord[]>([])
  const [cursor, setCursor] = useState<BookmarkCursor | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const failureRef = useRef<'initial' | 'more' | null>(null)
  const closeRef = useToolFocus(error)
  const generationRef = useRef(0)
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    const generation = ++generationRef.current
    setError(null)
    failureRef.current = null
    loadingMoreRef.current = false
    setIsLoadingMore(false)
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
      () => {
        if (generationRef.current !== generation) return
        failureRef.current = 'initial'
        setError('Bookmarks could not be loaded.')
        setIsInitialLoading(false)
      }
    )

    return () => {
      if (generationRef.current === generation) generationRef.current += 1
    }
  }, [chatId, retryToken])

  const loadMore = useCallback(
    (explicitRetry = false) => {
      if (!hasMore || !cursor || loadingMoreRef.current || (failureRef.current && !explicitRetry))
        return
      setError(null)
      failureRef.current = null
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
          () => {
            if (generationRef.current !== generation) return
            failureRef.current = 'more'
            setError('More bookmarks could not be loaded.')
          }
        )
        .finally(() => {
          if (generationRef.current === generation) {
            setIsLoadingMore(false)
            loadingMoreRef.current = false
          }
        })
    },
    [chatId, cursor, hasMore]
  )

  const retry = () => {
    if (failureRef.current === 'more') loadMore(true)
    else setRetryToken(current => current + 1)
  }

  const renderItem = useCallback(
    ({ item }: { item: BookmarkRecord }) => (
      <BookmarkRow record={item} onPress={() => onJump(item)} />
    ),
    [onJump]
  )

  return (
    <View className='bg-wa-bg flex-1'>
      <View className='bg-wa-header flex-row items-center border-b border-white/5 px-2 py-1'>
        <Pressable
          ref={closeRef}
          accessibilityRole='button'
          accessibilityLabel='Close bookmarks'
          className='size-11 items-center justify-center rounded-full active:bg-white/10'
          onPress={onClose}
        >
          <Ionicons name='arrow-back' size={24} color={colors.textPrimary} />
        </Pressable>
        <Text
          accessibilityRole='header'
          className='text-wa-text-primary ml-1 text-[17px] font-medium'
        >
          Bookmarks
        </Text>
      </View>

      {isInitialLoading ? (
        <View className='flex-1 items-center justify-center'>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlashList
          data={records}
          renderItem={renderItem}
          keyExtractor={item => item.messageId}
          contentContainerStyle={{ padding: 8 }}
          onEndReached={() => loadMore()}
          onEndReachedThreshold={0.35}
          ListEmptyComponent={
            error ? (
              <LoadError message={error} onRetry={retry} />
            ) : (
              <View className='items-center justify-center px-8 py-28'>
                <Ionicons name='bookmark-outline' size={42} color={colors.textSecondary} />
                <Text className='text-wa-text-secondary mt-3 text-center text-sm'>
                  Long-press a message to bookmark it
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            error && records.length > 0 ? (
              <LoadError message={error} onRetry={retry} />
            ) : isLoadingMore ? (
              <View className='items-center py-5'>
                <ActivityIndicator size='small' color={colors.accent} />
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
  const { colors } = useAppAppearance()
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
      className='bg-wa-header active:bg-wa-input mb-2 flex-row items-start rounded-xl px-3 py-3'
      onPress={onPress}
    >
      <View className='size-10 items-center justify-center rounded-full bg-[#00A884]/15'>
        <Ionicons name={icon} size={20} color={colors.accentLight} />
      </View>
      <View className='ml-3 flex-1'>
        <View className='flex-row items-center justify-between gap-3'>
          <Text className='flex-1 text-[13px] font-medium text-[#00A884]' numberOfLines={1}>
            {record.sender ?? 'System'}
          </Text>
          <Text className='text-wa-text-secondary text-[10.5px]'>{time}</Text>
        </View>
        <Text className='text-wa-text-primary mt-1 text-[13px] leading-5' numberOfLines={3}>
          {record.excerpt}
        </Text>
        {record.mediaType && (
          <Text className='text-wa-text-secondary mt-1 text-[10px] tracking-wide uppercase'>
            {record.mediaType}
          </Text>
        )}
      </View>
      <Ionicons name='chevron-forward' size={17} color={colors.textSecondary} />
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
