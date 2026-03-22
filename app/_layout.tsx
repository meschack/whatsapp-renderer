import type { SavedChat } from '@/models/types'
import '@/src/global.css'
import { getAllSavedChats } from '@/store/chatDatabase'
import { ChatContext, ChatData } from '@/store/chatStore'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useState } from 'react'

export default function RootLayout() {
  const [chatData, setChatData] = useState<ChatData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedChats, setSavedChats] = useState<SavedChat[]>(() => getAllSavedChats())

  const refreshSavedChats = useCallback(() => {
    setSavedChats(getAllSavedChats())
  }, [])

  return (
    <ChatContext.Provider
      value={{
        chatData,
        setChatData,
        isLoading,
        setIsLoading,
        error,
        setError,
        savedChats,
        refreshSavedChats
      }}
    >
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1F2C34' },
          headerTintColor: '#E9EDEF',
          contentStyle: { backgroundColor: '#0B141A' },
          animation: 'slide_from_right'
        }}
      >
        <Stack.Screen
          name='index'
          options={{
            title: 'Chats',
            headerTitleStyle: { color: '#E9EDEF', fontWeight: '600' }
          }}
        />
        <Stack.Screen name='chat' options={{ headerShown: false }} />
        <Stack.Screen
          name='select-sender'
          options={{
            title: 'Who are you?',
            presentation: 'modal',
            headerTitleStyle: { color: '#E9EDEF', fontWeight: '600' }
          }}
        />
      </Stack>
      <StatusBar style='light' />
    </ChatContext.Provider>
  )
}
