import { useCallback, useRef, useMemo } from 'react'
import { FlatList, ImageBackground } from 'react-native'
import { View } from '@/src/tw'
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

export default function ChatScreen() {
  const { chatData } = useChatStore()
  const insets = useSafeAreaInsets()
  const flatListRef = useRef<FlatList>(null)

  const listItems = useMemo(() => {
    if (!chatData) return []

    const items: ListItem[] = []
    let lastDateStr = ''
    let lastSender: string | null = null

    for (const msg of chatData.messages) {
      const dateStr = msg.timestamp.toDateString()

      // Add date separator
      if (dateStr !== lastDateStr) {
        items.push({
          type: 'date',
          id: `date-${dateStr}`,
          date: formatDateLabel(msg.timestamp)
        })
        lastDateStr = dateStr
        lastSender = null
      }

      // Show sender name when sender changes (for group chats)
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

    return items
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingTop: 8 }}
          initialNumToRender={30}
          maxToRenderPerBatch={20}
          windowSize={15}
          removeClippedSubviews
          getItemLayout={undefined}
        />
      </ImageBackground>
    </View>
  )
}
