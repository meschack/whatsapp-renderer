import { Ionicons } from '@expo/vector-icons'
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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MessageSearchResult[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generationRef = useRef(0)
  const loadingMoreRef = useRef(false)

  useEffect(() => {
    const generation = ++generationRef.current
    const trimmedQuery = query.trim()
    setResults([])
    setHasMore(false)
    setError(null)

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
          setError(searchError instanceof Error ? searchError.message : 'Search failed')
          setIsLoading(false)
        }
      )
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [chatId, query])

  const loadMore = useCallback(() => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery || !hasMore || loadingMoreRef.current) return

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
          setError(searchError instanceof Error ? searchError.message : 'Search failed')
        }
      )
      .finally(() => {
        if (generationRef.current === generation) setIsLoadingMore(false)
        loadingMoreRef.current = false
      })
  }, [chatId, hasMore, query, results])

  const renderResult = useCallback(
    ({ item }: { item: MessageSearchResult }) => (
      <SearchResultRow result={item} onPress={() => onSelect(item)} />
    ),
    [onSelect]
  )

  const emptyState = useMemo(() => {
    if (isLoading) return null
    if (error) return error
    if (!query.trim()) return 'Search messages in this chat'
    return 'No messages found'
  }, [error, isLoading, query])

  return (
    <View className='flex-1 bg-[#0B141A]'>
      <View className='flex-row items-center gap-2 border-b border-white/5 bg-[#202C33] px-3 py-2'>
        <Pressable
          accessibilityLabel='Close search'
          className='size-10 items-center justify-center rounded-full active:bg-white/10'
          onPress={onClose}
        >
          <Ionicons name='arrow-back' size={24} color='#E9EDEF' />
        </Pressable>
        <View className='h-11 flex-1 flex-row items-center rounded-full bg-[#2A3942] px-3'>
          <Ionicons name='search' size={19} color='#8696A0' />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder='Search messages'
            placeholderTextColor='#8696A0'
            selectionColor='#00A884'
            returnKeyType='search'
            className='ml-2 flex-1 text-[15px] text-[#E9EDEF]'
          />
          {query.length > 0 && (
            <Pressable
              accessibilityLabel='Clear search'
              className='size-8 items-center justify-center'
              onPress={() => setQuery('')}
            >
              <Ionicons name='close' size={20} color='#8696A0' />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View className='flex-1 items-center justify-center'>
          <ActivityIndicator color='#00A884' />
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={item => item.messageId}
          keyboardShouldPersistTaps='handled'
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          contentContainerStyle={results.length === 0 ? { flex: 1 } : undefined}
          ListEmptyComponent={
            emptyState ? (
              <View className='flex-1 items-center justify-center px-8'>
                <Ionicons name='search-outline' size={34} color='#667781' />
                <Text className='mt-3 text-center text-sm text-[#8696A0]'>{emptyState}</Text>
              </View>
            ) : null
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
    <Pressable className='border-b border-white/5 px-4 py-3 active:bg-white/5' onPress={onPress}>
      <View className='mb-1 flex-row items-center justify-between gap-3'>
        <Text className='flex-1 text-[13px] font-medium text-[#00A884]' numberOfLines={1}>
          {result.sender ?? 'System'}
        </Text>
        <Text className='text-[11px] text-[#8696A0]'>{timestamp}</Text>
      </View>
      <Text className='text-[14px] leading-5 text-[#D1D7DB]' numberOfLines={3}>
        {segments.map((segment, index) => (
          <Text
            key={`${index}-${segment.text}`}
            className={segment.highlighted ? 'bg-[#00A884]/35 text-[#FFFFFF]' : undefined}
          >
            {segment.text}
          </Text>
        ))}
      </Text>
    </Pressable>
  )
})
