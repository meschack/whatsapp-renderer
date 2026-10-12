import { useToolFocus } from '@/hooks/use-tool-focus'
import { LoadError } from '@/components/shared/load-error'
import { useAppAppearance } from '@/components/settings/app-appearance-provider'
import { ThemedIonicons as Ionicons } from '@/components/shared/themed-icon'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, FlatList } from 'react-native'

import { Pressable, Text, TextInput, View } from '@/src/tw'
import { searchMessages, type MessageSearchResult } from '@/store/message-database'
import { parseHighlightedExcerpt } from '@/utils/message-search'

const SEARCH_PAGE_SIZE = 30
const SEARCH_DEBOUNCE_MS = 250

interface ChatSearchProps {
  chatId: string
  onClose(): void
  onSelect(result: MessageSearchResult): void
}

export function ChatSearch({ chatId, onClose, onSelect }: ChatSearchProps) {
  const { colors } = useAppAppearance()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MessageSearchResult[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const failureRef = useRef<'initial' | 'more' | null>(null)
  const closeRef = useToolFocus(error)
  const generationRef = useRef(0)
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    const generation = ++generationRef.current
    const trimmedQuery = query.trim()
    setResults([])
    setHasMore(false)
    setError(null)
    failureRef.current = null
    loadingMoreRef.current = false
    setIsLoadingMore(false)

    if (!trimmedQuery) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const timer = setTimeout(() => {
      void searchMessages(chatId, trimmedQuery, SEARCH_PAGE_SIZE).then(
        page => {
          if (generationRef.current !== generation) return
          setResults(page.results)
          setHasMore(page.hasMore)
          setIsLoading(false)
        },
        searchError => {
          if (generationRef.current !== generation) return
          failureRef.current = 'initial'
          setError(searchError instanceof Error ? searchError.message : 'Search failed')
          setIsLoading(false)
        }
      )
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      if (generationRef.current === generation) generationRef.current = generation + 1
    }
  }, [chatId, query, retryToken])

  const loadMore = useCallback(
    (explicitRetry = false) => {
      const trimmedQuery = query.trim()
      if (
        !trimmedQuery ||
        !hasMore ||
        loadingMoreRef.current ||
        (failureRef.current && !explicitRetry)
      )
        return

      setError(null)
      failureRef.current = null
      loadingMoreRef.current = true
      setIsLoadingMore(true)
      const generation = generationRef.current
      const cursor = results.at(-1)?.sequence ?? 0
      void searchMessages(chatId, trimmedQuery, SEARCH_PAGE_SIZE, cursor)
        .then(
          page => {
            if (generationRef.current !== generation) return
            setResults(current => {
              const existing = new Set(current.map(result => result.sequence))
              return [...current, ...page.results.filter(result => !existing.has(result.sequence))]
            })
            setHasMore(page.hasMore)
          },
          searchError => {
            if (generationRef.current !== generation) return
            failureRef.current = 'more'
            setError(searchError instanceof Error ? searchError.message : 'Search failed')
          }
        )
        .finally(() => {
          if (generationRef.current === generation) {
            setIsLoadingMore(false)
            loadingMoreRef.current = false
          }
        })
    },
    [chatId, hasMore, query, results]
  )

  const retry = () => {
    if (failureRef.current === 'more') loadMore(true)
    else setRetryToken(current => current + 1)
  }

  const renderResult = useCallback(
    ({ item }: { item: MessageSearchResult }) => (
      <SearchResultRow result={item} onPress={() => onSelect(item)} />
    ),
    [onSelect]
  )

  const emptyState = useMemo(() => {
    if (isLoading) return null
    if (!query.trim()) return 'Search messages in this chat'
    return 'No messages found'
  }, [isLoading, query])

  return (
    <View className='bg-wa-bg flex-1'>
      <View className='bg-wa-header flex-row items-center gap-2 border-b border-white/5 px-3 py-2'>
        <Pressable
          ref={closeRef}
          accessibilityRole='button'
          accessibilityLabel='Close search'
          className='size-11 items-center justify-center rounded-full active:bg-white/10'
          onPress={onClose}
        >
          <Ionicons name='arrow-back' size={24} color={colors.textPrimary} />
        </Pressable>
        <View className='bg-wa-input h-11 flex-1 flex-row items-center rounded-full px-3'>
          <Ionicons name='search' size={19} color={colors.textSecondary} />
          <TextInput
            autoFocus
            testID='chat-search-input'
            accessibilityLabel='Search messages'
            value={query}
            onChangeText={setQuery}
            placeholder='Search messages'
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.accent}
            returnKeyType='search'
            className='text-wa-text-primary ml-2 flex-1 text-[15px]'
          />
          {query.length > 0 && (
            <Pressable
              accessibilityLabel='Clear search'
              className='size-11 items-center justify-center'
              onPress={() => setQuery('')}
            >
              <Ionicons name='close' size={20} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View className='flex-1 items-center justify-center'>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={item => item.messageId}
          keyboardShouldPersistTaps='handled'
          onEndReached={() => loadMore()}
          onEndReachedThreshold={0.3}
          contentContainerStyle={results.length === 0 ? { flex: 1 } : undefined}
          ListEmptyComponent={
            error && results.length === 0 ? (
              <LoadError message={error} onRetry={retry} />
            ) : emptyState ? (
              <View className='flex-1 items-center justify-center px-8'>
                <Ionicons name='search-outline' size={34} color={colors.textSecondary} />
                <Text className='text-wa-text-secondary mt-3 text-center text-sm'>
                  {emptyState}
                </Text>
              </View>
            ) : null
          }
          ListFooterComponent={
            error && results.length > 0 ? (
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

const SearchResultRow = memo(function SearchResultRow({
  result,
  onPress
}: {
  result: MessageSearchResult
  onPress(): void
}) {
  const timestamp = useMemo(
    () =>
      result.timestamp.toLocaleString([], {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
    [result.timestamp]
  )
  const segments = useMemo(() => parseHighlightedExcerpt(result.excerpt), [result.excerpt])

  return (
    <Pressable
      accessibilityLabel={`${result.sender ?? 'System'}, ${result.excerpt}`}
      accessibilityHint='Jump to message'
      accessibilityRole='button'
      className='border-b border-white/5 px-4 py-3 active:bg-white/5'
      onPress={onPress}
    >
      <View className='mb-1 flex-row items-center justify-between gap-3'>
        <Text className='flex-1 text-[13px] font-medium text-[#00A884]' numberOfLines={1}>
          {result.sender ?? 'System'}
        </Text>
        <Text className='text-wa-text-secondary text-[11px]'>{timestamp}</Text>
      </View>
      <Text className='text-wa-text-primary text-[14px] leading-5' numberOfLines={3}>
        {segments.map((segment, index) => (
          <Text
            key={`${index}-${segment.text}`}
            className={segment.highlighted ? 'bg-wa-accent/20 text-wa-text-primary' : undefined}
          >
            {segment.text}
          </Text>
        ))}
      </Text>
    </Pressable>
  )
})
