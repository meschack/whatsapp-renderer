import { useCallback, useRef, useMemo, useState } from 'react'
import { FlatList, ImageBackground, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { View, Pressable } from '@/src/tw'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useChatStore } from '@/store/chatStore'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { ChatBubble } from '@/components/chat/ChatBubble'
import { SystemMessage } from '@/components/chat/SystemMessage'
import { DateSeparator } from '@/components/chat/DateSeparator'
import type { Message } from '@/models/types'

type ListItem =
  | { type: 'date'; id: string; date: string }
  | { type: 'message'; id: string; message: Message; showSender: boolean }

function formatDateLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

const SCROLL_THRESHOLD = 300

export default function ChatScreen() {
  const { chatData } = useChatStore()
  const insets = useSafeAreaInsets()
  const flatListRef = useRef<FlatList>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  // Track last value to avoid redundant setState calls
  const lastScrollState = useRef(false)

  const listItems = useMemo(() => {
    if (!chatData) return []

    const items: ListItem[] = []
    let lastDateStr = ''
    let lastSender: string | null = null

    for (const msg of chatData.messages) {
      const dateStr = msg.timestamp.toDateString()

      if (dateStr !== lastDateStr) {
        items.push({
          type: 'date',
          id: `date-${dateStr}`,
          date: formatDateLabel(msg.timestamp)
        })
        lastDateStr = dateStr
        lastSender = null
      }

      const showSender = msg.sender !== lastSender && !msg.isSystem

      if (msg.isSystem) {
        items.push({
          type: 'message',
          id: msg.id,
          message: msg,
          showSender: false
        })
      } else {
        items.push({
          type: 'message',
          id: msg.id,
          message: msg,
          showSender
        })
        lastSender = msg.sender
      }
    }

    // Reverse for inverted FlatList — latest messages render first at the bottom
    return items.reverse()
  }, [chatData])

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

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const shouldShow = e.nativeEvent.contentOffset.y > SCROLL_THRESHOLD
      // Only call setState when the value actually changes
      if (shouldShow !== lastScrollState.current) {
        lastScrollState.current = shouldShow
        setShowScrollButton(shouldShow)
      }
    },
    []
  )

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [])

  if (!chatData) {
    return <View className='flex-1 bg-wa-bg' />
  }

  return (
    <View className='flex-1 bg-wa-bg'>
      <ChatHeader
        chatName={chatData.chatName}
        participantCount={chatData.participants.length}
      />

      <ImageBackground
        source={require('@/assets/images/wallpaper.jpeg')}
        style={{ flex: 1 }}
        resizeMode='cover'
      >
        <FlatList
          ref={flatListRef}
          data={listItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          inverted
          contentContainerStyle={{ paddingTop: insets.bottom + 16, paddingBottom: 8 }}
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          windowSize={11}
          removeClippedSubviews
          onScroll={handleScroll}
          scrollEventThrottle={400}
        />

        {showScrollButton && (
          <Pressable
            className='absolute bottom-5 right-4 h-10 w-10 items-center justify-center rounded-full bg-wa-header'
            style={{
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
  )
}
