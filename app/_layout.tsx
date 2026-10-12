import { Alert } from 'react-native'
import {
  AppAppearanceProvider,
  useAppAppearance
} from '@/components/settings/app-appearance-provider'
import { AppLockProvider } from '@/components/settings/app-lock-provider'
import { AppSettingsButton } from '@/components/settings/app-settings'
import { resetLocalArchive } from '@/utils/reset-local-archive'
import type { SavedChat } from '@/models/types'
import '@/src/global.css'
import { getAllSavedChats } from '@/store/chat-database'
import { bootstrapArchive } from '@/store/archive-database'
import { ChatContext, ChatData, useChatStore } from '@/store/chat-store'
import { ActivityIndicator, Pressable, Text, View } from '@/src/tw'
import { Stack, usePathname, useRouter } from 'expo-router'
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

  const resetLockedArchive = () =>
    new Promise<void>((resolve, reject) => {
      let decided = false
      Alert.alert(
        'Reset Kinsay and its passcode?',
        'This permanently deletes all saved chats, media, bookmarks and preferences. You will need your original WhatsApp exports to import them again.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => {
              decided = true
              reject(new Error('Reset cancelled'))
            }
          },
          {
            text: 'Delete local archive',
            style: 'destructive',
            onPress: () => {
              decided = true
              void resetLocalArchive().then(() => {
                setChatData(null)
                setSavedChats([])
                setError(null)
                setIsLoading(false)
                resolve()
              }, reject)
            }
          }
        ],
        {
          cancelable: true,
          onDismiss: () => {
            if (!decided) reject(new Error('Reset cancelled'))
          }
        }
      )
    })
  return (
    <AppAppearanceProvider>
      <AppLockProvider onResetAllData={resetLockedArchive}>
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
            <ArchiveNavigator />
          </AudioPlayerProvider>
        </ChatContext.Provider>
      </AppLockProvider>
    </AppAppearanceProvider>
  )
}

function ArchiveNavigator() {
  const { colors, resolvedTheme } = useAppAppearance()
  const { chatData } = useChatStore()
  const pathname = usePathname()
  const router = useRouter()
  useEffect(() => {
    if (!chatData && pathname !== '/') router.replace('/')
  }, [chatData, pathname, router])
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.headerBackground },
          headerTintColor: colors.textPrimary,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
          headerTitleStyle: { fontFamily: 'Satoshi-Bold' }
        }}
      >
        <Stack.Screen
          name='index'
          options={{ title: 'Chats', headerRight: () => <AppSettingsButton /> }}
        />
        <Stack.Screen name='chat' options={{ headerShown: false }} />
        <Stack.Screen
          name='select-sender'
          options={{ title: 'Who are you?', presentation: 'modal' }}
        />
      </Stack>
      <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
    </>
  )
}
