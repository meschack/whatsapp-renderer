import type { SavedChat } from '@/models/types'
import '@/src/global.css'
import { getAllSavedChats } from '@/store/chat-database'
import { bootstrapArchive } from '@/store/archive-database'
import { ChatContext, ChatData } from '@/store/chat-store'
import { ActivityIndicator, Pressable, Text, View } from '@/src/tw'
import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AudioPlayerProvider } from '@/components/chat/audio-player-provider'

void SplashScreen.preventAutoHideAsync()

type BootstrapState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string }

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Satoshi: require('@/assets/fonts/Satoshi-Regular.ttf'),
    'Satoshi-Medium': require('@/assets/fonts/Satoshi-Medium.ttf'),
    'Satoshi-Bold': require('@/assets/fonts/Satoshi-Bold.ttf')
  })
  const [chatData, setChatData] = useState<ChatData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedChats, setSavedChats] = useState<SavedChat[]>([])
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>({ status: 'loading' })

  const startBootstrap = useCallback(async () => {
    setBootstrapState({ status: 'loading' })
    const result = await bootstrapArchive()

    if (result.status === 'error') {
      setBootstrapState({ status: 'error', message: result.error.message })
      return
    }

    setSavedChats(result.savedChats)
    setBootstrapState({ status: 'ready' })
  }, [])

  const refreshSavedChats = useCallback(() => {
    setSavedChats(getAllSavedChats())
  }, [])

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync()
  }, [fontError, fontsLoaded])

  useEffect(() => {
    void startBootstrap()
  }, [startBootstrap])

  if (!fontsLoaded && !fontError) return null

  if (bootstrapState.status !== 'ready') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0B141A' }}>
        <View className='flex-1 items-center justify-center px-8'>
          {bootstrapState.status === 'loading' ? (
            <>
              <ActivityIndicator size='large' color='#00A884' />
              <Text className='mt-4 text-base text-[#AEBAC1]'>Opening your chat archive…</Text>
            </>
          ) : (
            <>
              <Text
                className='text-center text-xl text-[#E9EDEF]'
                style={{ fontFamily: 'Satoshi-Bold' }}
              >
                Couldn&apos;t open your chat archive
              </Text>
              <Text className='mt-2 text-center text-sm leading-5 text-[#AEBAC1]'>
                {bootstrapState.message}
              </Text>
              <Pressable
                accessibilityRole='button'
                className='mt-6 rounded-full bg-[#00A884] px-7 py-3 active:opacity-80'
                onPress={() => void startBootstrap()}
              >
                <Text className='text-base text-[#0B141A]' style={{ fontFamily: 'Satoshi-Bold' }}>
                  Try again
                </Text>
              </Pressable>
            </>
          )}
        </View>
        <StatusBar style='light' />
      </SafeAreaView>
    )
  }

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
      <AudioPlayerProvider>
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
      </AudioPlayerProvider>
    </ChatContext.Provider>
  )
}
