import type { SavedChat } from '@/models/types'
import '@/src/global.css'
import { getAllSavedChats } from '@/store/chat-database'
import { ChatContext, ChatData } from '@/store/chat-store'
import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'

void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Satoshi: require('@/assets/fonts/Satoshi-Regular.ttf'),
    'Satoshi-Medium': require('@/assets/fonts/Satoshi-Medium.ttf'),
    'Satoshi-Bold': require('@/assets/fonts/Satoshi-Bold.ttf')
  })
  const [chatData, setChatData] = useState<ChatData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedChats, setSavedChats] = useState<SavedChat[]>(() => getAllSavedChats())

  const refreshSavedChats = useCallback(() => {
    setSavedChats(getAllSavedChats())
  }, [])

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync()
  }, [fontError, fontsLoaded])

  if (!fontsLoaded && !fontError) return null

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
          headerStyle: { backgroundColor: '#202C33' },
          headerTintColor: '#E9EDEF',
          contentStyle: { backgroundColor: '#0B141A' },
          animation: 'slide_from_right',
          headerTitleStyle: { fontFamily: 'Satoshi-Bold' }
        }}
      >
        <Stack.Screen
          name='index'
          options={{
            title: 'Chats',
            headerTitleStyle: { color: '#E9EDEF', fontFamily: 'Satoshi-Bold' }
          }}
        />
        <Stack.Screen name='chat' options={{ headerShown: false }} />
        <Stack.Screen
          name='select-sender'
          options={{
            title: 'Who are you?',
            presentation: 'modal',
            headerTitleStyle: { color: '#E9EDEF', fontFamily: 'Satoshi-Bold' }
          }}
        />
      </Stack>
      <StatusBar style='light' />
    </ChatContext.Provider>
  )
}
