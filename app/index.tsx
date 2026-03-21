import { useState, useCallback } from 'react'
import { Alert, FlatList } from 'react-native'
import { useRouter } from 'expo-router'
import { Directory, File } from 'expo-file-system'
import * as DocumentPicker from 'expo-document-picker'
import { Ionicons } from '@expo/vector-icons'
import { View, Text, TouchableOpacity, Pressable, ActivityIndicator } from '@/src/tw'
import { useChatStore } from '@/store/chatStore'
import { deleteSavedChat } from '@/store/chatDatabase'
import { cleanupExtractedChat, extractZip } from '@/utils/zipExtractor'
import { scanForMedia, findChatFile } from '@/utils/fileScanner'
import { parseChat } from '@/utils/parser'
import { ChatListItem } from '@/components/home/ChatListItem'
import type { SavedChat } from '@/models/types'

export default function HomeScreen() {
  const router = useRouter()
  const {
    setChatData,
    isLoading,
    setIsLoading,
    error,
    setError,
    savedChats,
    refreshSavedChats
  } = useChatStore()
  const [statusText, setStatusText] = useState('')

  const handleImport = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      setStatusText('Picking file...')

      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/zip',
        copyToCacheDirectory: true
      })

      if (result.canceled) {
        setIsLoading(false)
        setStatusText('')
        return
      }

      const pickedFile = result.assets[0]
      if (!pickedFile) {
        setIsLoading(false)
        setStatusText('')
        return
      }

      setStatusText('Extracting zip file...')
      const extractDirUri = await extractZip(pickedFile.uri)

      setStatusText('Scanning for media files...')
      const mediaMap = scanForMedia(extractDirUri)

      setStatusText('Finding chat file...')
      const chatFileUri = findChatFile(extractDirUri)

      if (!chatFileUri) {
        throw new Error('No chat file found in the archive. Make sure this is a WhatsApp export.')
      }

      setStatusText('Parsing messages...')
      const chatFile = new File(chatFileUri)
      const chatContent = await chatFile.text()

      const { messages, participants } = parseChat(chatContent, mediaMap)

      if (messages.length === 0) {
        throw new Error('No messages found in the chat file.')
      }

      const chatName = pickedFile.name?.replace('.zip', '').replace('WhatsApp Chat - ', '') ?? 'Chat'

      setChatData({
        messages,
        participants,
        chatName,
        myName: '',
        extractDirUri
      })

      setStatusText('')
      setIsLoading(false)
      router.push('/select-sender')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(message)
      setIsLoading(false)
      setStatusText('')
      Alert.alert('Import Error', message)
    }
  }, [router, setChatData, setIsLoading, setError])

  const handleOpenChat = useCallback(
    async (chat: SavedChat) => {
      try {
        setIsLoading(true)
        setError(null)
        setStatusText('Loading chat...')

        // Verify directory still exists
        const dir = new Directory(chat.extractDirUri)
        if (!dir.exists) {
          deleteSavedChat(chat.id)
          refreshSavedChats()
          throw new Error('Chat data was deleted from device. Removing from list.')
        }

        const mediaMap = scanForMedia(chat.extractDirUri)
        const chatFileUri = findChatFile(chat.extractDirUri)

        if (!chatFileUri) {
          throw new Error('Chat file no longer found on disk.')
        }

        const chatFile = new File(chatFileUri)
        const chatContent = await chatFile.text()
        const { messages, participants } = parseChat(chatContent, mediaMap, chat.myName)

        setChatData({
          messages,
          participants,
          chatName: chat.chatName,
          myName: chat.myName,
          extractDirUri: chat.extractDirUri
        })

        setStatusText('')
        setIsLoading(false)
        router.push('/chat')
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred'
        setError(message)
        setIsLoading(false)
        setStatusText('')
        Alert.alert('Error', message)
      }
    },
    [router, setChatData, setIsLoading, setError, refreshSavedChats]
  )

  const handleDeleteChat = useCallback(
    (chat: SavedChat) => {
      Alert.alert('Delete Chat', `Remove "${chat.chatName}" from the list?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            cleanupExtractedChat(chat.extractDirUri)
            deleteSavedChat(chat.id)
            refreshSavedChats()
          }
        }
      ])
    },
    [refreshSavedChats]
  )

  // Loading overlay
  if (isLoading) {
    return (
      <View className='flex-1 bg-wa-bg justify-center items-center gap-3'>
        <ActivityIndicator size='large' color='#00A884' />
        <Text className='text-sm text-wa-text-secondary'>{statusText}</Text>
      </View>
    )
  }

  // Empty state - no saved chats yet
  if (savedChats.length === 0) {
    return (
      <View className='flex-1 bg-wa-bg'>
        <View className='flex-1 justify-center items-center px-6'>
          <View className='mb-6 w-36 h-36 rounded-full bg-wa-header justify-center items-center'>
            <Ionicons name='chatbubbles' size={80} color='#00A884' />
          </View>

          <Text className='text-[22px] font-bold text-wa-text-primary mb-2 text-center'>
            WhatsApp Chat Renderer
          </Text>
          <Text className='text-sm text-wa-text-secondary text-center leading-6 mb-6'>
            Import a WhatsApp chat export (.zip) to view your conversations in a beautiful interface.
          </Text>

          <View className='self-stretch mb-8 gap-3'>
            <StepItem number='1' text='Export a chat from WhatsApp' />
            <StepItem number='2' text='Choose the .zip file below' />
            <StepItem number='3' text='View your conversation' />
          </View>

          <TouchableOpacity
            className='flex-row items-center justify-center bg-wa-accent py-4 px-6 rounded-xl self-stretch'
            onPress={handleImport}
            activeOpacity={0.7}
          >
            <Ionicons name='document-attach' size={24} color='#FFFFFF' style={{ marginRight: 8 }} />
            <Text className='text-white text-base font-semibold'>Import .zip File</Text>
          </TouchableOpacity>

          {error && (
            <View className='flex-row items-center gap-2 mt-4 p-3 bg-wa-error/10 rounded-lg'>
              <Ionicons name='warning' size={20} color='#FF6B6B' />
              <Text className='text-wa-error text-xs flex-1'>{error}</Text>
            </View>
          )}
        </View>
      </View>
    )
  }

  // Chat list
  return (
    <View className='flex-1 bg-wa-bg'>
      <FlatList
        data={savedChats}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ChatListItem
            chat={item}
            onPress={() => handleOpenChat(item)}
            onLongPress={() => handleDeleteChat(item)}
          />
        )}
        ItemSeparatorComponent={() => <View className='h-px bg-wa-divider ml-[72px]' />}
      />

      {/* FAB */}
      <Pressable
        className='absolute bottom-6 right-5 w-14 h-14 rounded-full bg-wa-accent justify-center items-center'
        style={{ elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4 }}
        onPress={handleImport}
      >
        <Ionicons name='add' size={28} color='#FFFFFF' />
      </Pressable>
    </View>
  )
}

const StepItem = ({ number, text }: { number: string; text: string }) => {
  return (
    <View className='flex-row items-center gap-3'>
      <View className='w-8 h-8 rounded-full bg-wa-accent justify-center items-center'>
        <Text className='text-white font-bold text-sm'>{number}</Text>
      </View>
      <Text className='text-wa-text-primary text-base flex-1'>{text}</Text>
    </View>
  )
}
