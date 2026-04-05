import { AudioPlayerProvider } from '@/components/chat/AudioPlayerProvider'
import { ChatBubble } from '@/components/chat/ChatBubble'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { DateSeparator } from '@/components/chat/DateSeparator'
import { SystemMessage } from '@/components/chat/SystemMessage'
import { useMessagePages, type ListItem } from '@/hooks/useMessagePages'
import { Pressable, View } from '@/src/tw'
import { useChatStore } from '@/store/chatStore'
import { Ionicons } from '@expo/vector-icons'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  ImageBackground,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const SCROLL_THRESHOLD = 300

export default function ChatScreen() {
  const { chatData } = useChatStore()
  const insets = useSafeAreaInsets()
  const flashListRef = useRef<FlashListRef<ListItem>>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const lastScrollState = useRef(false)

  const { items, loadMore, hasMore, isLoadingMore } = useMessagePages(
    chatData?.chatId ?? '',
    chatData?.messageCount ?? 0
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
    if (item.message.mediaType) return 'media'
    return 'text'
  }, [])

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const shouldShow = e.nativeEvent.contentOffset.y > SCROLL_THRESHOLD
    if (shouldShow !== lastScrollState.current) {
      lastScrollState.current = shouldShow
      setShowScrollButton(shouldShow)
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    flashListRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore()
    }
  }, [hasMore, isLoadingMore, loadMore])

  if (!chatData) {
    return <View className='bg-wa-bg flex-1' />
  }

  return (
    <AudioPlayerProvider>
      <View className='bg-wa-bg flex-1'>
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
            inverted
            contentContainerStyle={{ paddingTop: insets.bottom + 16, paddingBottom: 8 }}
            onScroll={handleScroll}
            scrollEventThrottle={400}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoadingMore ? (
                <View className='items-center py-4'>
                  <ActivityIndicator size='small' color='#00A884' />
                </View>
              ) : null
            }
          />

          {showScrollButton && (
            <Pressable
              className='bg-wa-header absolute right-4 h-10 w-10 items-center justify-center rounded-full'
              style={{
                bottom: insets.bottom + 20,
                elevation: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 3
              }}
              onPress={scrollToBottom}
            >
              <Ionicons name='chevron-down' size={22} color='#8696A0' />
            </Pressable>
          )}
        </ImageBackground>
      </View>
    </AudioPlayerProvider>
  )
}
