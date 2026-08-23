import { AudioPlayerProvider } from '@/components/chat/audio-player-provider'
import { ChatBubble } from '@/components/chat/chat-bubble'
import { ChatComposer } from '@/components/chat/chat-composer'
import { ChatHeader } from '@/components/chat/chat-header'
import { DateSeparator } from '@/components/chat/date-separator'
import { SystemMessage } from '@/components/chat/system-message'
import { useChatPerformance } from '@/hooks/use-chat-performance'
import { useMessagePages, type ListItem } from '@/hooks/use-message-pages'
import { useTimelineBudget } from '@/hooks/use-timeline-budget'
import { Pressable, Text, View } from '@/src/tw'
import { useChatStore } from '@/store/chat-store'
import { formatDateLabel } from '@/utils/chat-timeline'
import { Ionicons } from '@expo/vector-icons'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ImageBackground,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const SCROLL_THRESHOLD = 300
const MAINTAIN_SCROLL_POSITION = {
  startRenderingFromBottom: true,
  autoscrollToBottomThreshold: 0.1,
  animateAutoScrollToBottom: false
} as const

export default function ChatScreen() {
  const { chatData } = useChatStore()
  const flashListRef = useRef<FlashListRef<ListItem>>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [visibleDate, setVisibleDate] = useState<string | null>(null)
  const [showDateChip, setShowDateChip] = useState(false)
  const lastScrollState = useRef(false)
  const hideDateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const benchmarkStarted = useRef(false)
  const { budget, profile } = useTimelineBudget()
  const { onPageLoad, onLoad, benchmarkEnabled, startBenchmark } = useChatPerformance(
    flashListRef,
    { budget, device: profile }
  )

  const {
    items,
    loadOlder,
    loadNewer,
    hasOlder,
    hasNewer,
    isInitialLoading,
    isLoadingOlder,
    isLoadingNewer
  } = useMessagePages(chatData?.chatId ?? '', {
    pageSize: budget.pageSize,
    maxMessages: budget.maxMessages,
    onPageLoad
  })

  useEffect(() => {
    if (!benchmarkEnabled || benchmarkStarted.current || items.length === 0) return
    benchmarkStarted.current = true
    startBenchmark()
  }, [benchmarkEnabled, items.length, startBenchmark])

  useEffect(
    () => () => {
      if (hideDateTimer.current) clearTimeout(hideDateTimer.current)
    },
    []
  )

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'date') {
      return <DateSeparator date={item.date} />
    }

    if (item.message.isSystem) {
      return <SystemMessage text={item.message.text} />
    }

    return <ChatBubble message={item.message} showSender={item.showSender} />
  }, [])

  const keyExtractor = useCallback((item: ListItem) => item.id, [])

  const getItemType = useCallback((item: ListItem) => {
    if (item.type === 'date') return 'date'
    if (item.message.isSystem) return 'system'
    if (item.message.mediaType) return `media-${item.message.mediaType}`
    return 'text'
  }, [])

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height)
    const shouldShow = distanceFromBottom > SCROLL_THRESHOLD
    if (shouldShow !== lastScrollState.current) {
      lastScrollState.current = shouldShow
      setShowScrollButton(shouldShow)
    }
  }, [])

  const showVisibleDate = useCallback(() => {
    if (hideDateTimer.current) clearTimeout(hideDateTimer.current)
    hideDateTimer.current = null
    setShowDateChip(true)
  }, [])

  const hideVisibleDateSoon = useCallback(() => {
    if (hideDateTimer.current) clearTimeout(hideDateTimer.current)
    hideDateTimer.current = setTimeout(() => setShowDateChip(false), 1100)
  }, [])

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<ListItem>[] }) => {
      const firstVisible = viewableItems
        .filter(token => token.isViewable && token.index !== null)
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0]?.item

      if (!firstVisible) return
      const label =
        firstVisible.type === 'date'
          ? firstVisible.date
          : formatDateLabel(firstVisible.message.timestamp)
      setVisibleDate(previous => (previous === label ? previous : label))
    },
    []
  )

  const scrollToBottom = useCallback(() => {
    setShowDateChip(false)
    flashListRef.current?.scrollToEnd({ animated: true })
  }, [])

  const handleStartReached = useCallback(() => {
    if (hasOlder && !isLoadingOlder) void loadOlder()
  }, [hasOlder, isLoadingOlder, loadOlder])

  const handleEndReached = useCallback(() => {
    if (hasNewer && !isLoadingNewer) void loadNewer()
  }, [hasNewer, isLoadingNewer, loadNewer])

  if (!chatData) {
    return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#0B141A' }} />
  }

  return (
    <AudioPlayerProvider>
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#0B141A' }}>
        <ChatHeader chatName={chatData.chatName} participantCount={chatData.participants.length} />

        <ImageBackground
          source={require('@/assets/images/wallpaper.jpeg')}
          style={{ flex: 1 }}
          resizeMode='cover'
        >
          <FlashList
            ref={flashListRef}
            data={items}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            getItemType={getItemType}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 8 }}
            maintainVisibleContentPosition={MAINTAIN_SCROLL_POSITION}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            onScrollBeginDrag={showVisibleDate}
            onScrollEndDrag={hideVisibleDateSoon}
            onMomentumScrollEnd={hideVisibleDateSoon}
            onViewableItemsChanged={handleViewableItemsChanged}
            onStartReached={handleStartReached}
            onStartReachedThreshold={0.35}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.2}
            onLoad={onLoad}
            ListHeaderComponent={
              isLoadingOlder ? (
                <View className='items-center py-4'>
                  <ActivityIndicator size='small' color='#00A884' />
                </View>
              ) : null
            }
            ListFooterComponent={
              isLoadingNewer ? (
                <View className='items-center py-4'>
                  <ActivityIndicator size='small' color='#00A884' />
                </View>
              ) : null
            }
          />

          {isInitialLoading && (
            <View className='absolute inset-0 items-center justify-center'>
              <ActivityIndicator size='small' color='#00A884' />
            </View>
          )}

          {showDateChip && visibleDate && (
            <View
              pointerEvents='none'
              className='absolute top-2 self-center rounded-lg bg-[#182229]/95 px-3 py-1'
              style={{ elevation: 3 }}
            >
              <Text className='text-[11.5px] font-medium text-[#E9EDEF]'>{visibleDate}</Text>
            </View>
          )}

          {showScrollButton && (
            <Pressable
              className='bg-wa-header absolute right-3.5 flex size-10 items-center justify-center rounded-full'
              style={{
                bottom: 12,
                elevation: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 3
              }}
              onPress={scrollToBottom}
            >
              <Ionicons name='chevron-down' size={22} color='#FFFFFF' />
            </Pressable>
          )}
        </ImageBackground>

        <ChatComposer />
      </SafeAreaView>
    </AudioPlayerProvider>
  )
}
