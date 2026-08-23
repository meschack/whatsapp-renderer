import { useState, useCallback, useRef } from 'react'
import { Alert, FlatList } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Directory } from 'expo-file-system'
import * as DocumentPicker from 'expo-document-picker'
import { Ionicons } from '@expo/vector-icons'
import { View, Text, TouchableOpacity, Pressable, ActivityIndicator } from '@/src/tw'
import { useChatStore } from '@/store/chat-store'
import { deleteSavedChat, deleteAllSavedChats } from '@/store/chat-database'
import {
  applyMediaIndex,
  deleteMessages,
  getMessageCount,
  getParticipants,
  hasMessages,
  hasUnindexedMedia
} from '@/store/message-database'
import { cleanupExtractedChat } from '@/utils/zip-extractor'
import { scanForMedia, findChatFile } from '@/utils/file-scanner'
import { parseChat } from '@/utils/parser'
import { indexMedia } from '@/utils/media-index'
import { openFileTranscript } from '@/utils/transcript-stream'
import { importChat } from '@/utils/chat-import'
import {
  ImportCancelledError,
  type ChatImportPhase,
  type DuplicateImportChoice
} from '@/utils/chat-import-workflow'
import { ChatListItem } from '@/components/home/chat-list-item'
import type { MediaMap, SavedChat } from '@/models/types'

const IMPORT_STATUS_TEXT: Record<ChatImportPhase, string> = {
  extracting: 'Extracting archive',
  discovering: 'Finding messages and media',
  'checking-duplicate': 'Checking for duplicates',
  'indexing-media': 'Preparing media previews',
  reading: 'Reading transcript',
  parsing: 'Importing messages',
  persisting: 'Saving chat',
  complete: 'Import complete',
  'rolling-back': 'Cleaning up failed import'
}

export default function HomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { setChatData, isLoading, setIsLoading, error, setError, savedChats, refreshSavedChats } =
    useChatStore()
  const [statusText, setStatusText] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const importControllerRef = useRef<AbortController | null>(null)

  const chooseDuplicate = useCallback(
    (chat: SavedChat) =>
      new Promise<DuplicateImportChoice>(resolve => {
        Alert.alert(
          'Chat already imported',
          `“${chat.chatName}” has the same chat content. What should happen?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve('cancel') },
            { text: 'Replace', style: 'destructive', onPress: () => resolve('replace') },
            { text: 'Open existing', onPress: () => resolve('open') }
          ],
          { cancelable: true, onDismiss: () => resolve('cancel') }
        )
      }),
    []
  )

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

      const controller = new AbortController()
      importControllerRef.current = controller
      setIsImporting(true)

      const { chat, outcome } = await importChat({
        temporaryArchiveUri: pickedFile.uri,
        archiveName: pickedFile.name ?? 'Chat.zip',
        signal: controller.signal,
        onDuplicate: chooseDuplicate,
        onProgress: ({ phase, completed, total, phaseCompleted, phaseTotal }) => {
          const percentage = Math.round((completed / total) * 100)
          const itemProgress =
            phaseCompleted !== undefined && phaseTotal !== undefined
              ? ` · ${phaseCompleted}/${phaseTotal}`
              : ` · ${percentage}%`
          setStatusText(`${IMPORT_STATUS_TEXT[phase]}${itemProgress}`)
        }
      })

      setChatData({
        chatId: chat.id,
        participants: chat.participants,
        chatName: chat.chatName,
        myName: chat.myName,
        extractDirUri: chat.extractDirUri,
        messageCount: chat.messageCount,
        importedAt: chat.importedAt
      })
      refreshSavedChats()

      setStatusText('')
      setIsLoading(false)
      setIsImporting(false)
      importControllerRef.current = null
      router.push(outcome === 'opened-existing' ? '/chat' : '/select-sender')
    } catch (err: unknown) {
      const wasCancelled =
        err instanceof ImportCancelledError || (err instanceof Error && err.name === 'AbortError')
      const message = err instanceof Error ? err.message : 'An unknown error occurred'
      setError(wasCancelled ? null : message)
      setIsLoading(false)
      setIsImporting(false)
      importControllerRef.current = null
      setStatusText('')
      if (!wasCancelled) Alert.alert('Import Error', message)
    }
  }, [chooseDuplicate, refreshSavedChats, router, setChatData, setIsLoading, setError])

  const handleOpenChat = useCallback(
    async (chat: SavedChat) => {
      try {
        setIsLoading(true)
        setError(null)
        setStatusText('Loading chat...')

        // Verify directory still exists
        const dir = new Directory(chat.extractDirUri)
        if (!dir.exists) {
          deleteMessages(chat.id)
          deleteSavedChat(chat.id)
          refreshSavedChats()
          throw new Error('Chat data was deleted from device. Removing from list.')
        }

        const needsMessageMigration = !hasMessages(chat.id)
        const needsMediaMigration = needsMessageMigration || (await hasUnindexedMedia(chat.id))
        let mediaMap: MediaMap | null = null
        if (needsMediaMigration) {
          setStatusText('Preparing media previews...')
          const mediaCandidates = scanForMedia(chat.extractDirUri)
          mediaMap = await indexMedia(mediaCandidates, chat.extractDirUri, progress => {
            setStatusText(`Preparing media previews · ${progress.completed}/${progress.total}`)
          })

          if (!needsMessageMigration) {
            await applyMediaIndex(chat.id, mediaMap)
          }
        }

        if (needsMessageMigration) {
          setStatusText('Migrating chat data...')
          const chatFileUri = findChatFile(chat.extractDirUri)

          if (!chatFileUri) {
            throw new Error('Chat file no longer found on disk.')
          }

          try {
            await parseChat(
              openFileTranscript(chatFileUri),
              mediaMap ?? new Map(),
              chat.id,
              chat.myName
            )
          } catch (error) {
            deleteMessages(chat.id)
            throw error
          }
        }

        const messageCount = getMessageCount(chat.id)
        const participants = getParticipants(chat.id)

        setChatData({
          chatId: chat.id,
          participants,
          chatName: chat.chatName,
          myName: chat.myName,
          extractDirUri: chat.extractDirUri,
          messageCount,
          importedAt: chat.importedAt
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
            deleteMessages(chat.id)
            deleteSavedChat(chat.id)
            refreshSavedChats()
          }
        }
      ])
    },
    [refreshSavedChats]
  )

  const handleResetAll = useCallback(() => {
    Alert.alert(
      'Reset All Chats',
      'This will remove all imported chats and their data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: () => {
            for (const chat of savedChats) {
              cleanupExtractedChat(chat.extractDirUri)
              deleteMessages(chat.id)
            }
            deleteAllSavedChats()
            refreshSavedChats()
          }
        }
      ]
    )
  }, [savedChats, refreshSavedChats])

  const renderChatItem = useCallback(
    ({ item }: { item: SavedChat }) => (
      <ChatListItem
        chat={item}
        onPress={() => handleOpenChat(item)}
        onLongPress={() => handleDeleteChat(item)}
      />
    ),
    [handleOpenChat, handleDeleteChat]
  )

  const chatKeyExtractor = useCallback((item: SavedChat) => item.id, [])

  // Loading overlay
  if (isLoading) {
    return (
      <SafeAreaView
        edges={['bottom']}
        style={{
          flex: 1,
          backgroundColor: '#0B141A',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12
        }}
      >
        <ActivityIndicator size='large' color='#00A884' />
        <Text className='text-wa-text-secondary text-sm'>{statusText}</Text>
        {isImporting && (
          <Pressable
            className='mt-2 rounded-full border border-[#FF6B6B]/60 px-5 py-2 active:bg-[#FF6B6B]/10'
            onPress={() => {
              setStatusText('Cancelling import…')
              importControllerRef.current?.abort()
            }}
          >
            <Text className='text-sm font-medium text-[#FF6B6B]'>Cancel import</Text>
          </Pressable>
        )}
      </SafeAreaView>
    )
  }

  // Empty state - no saved chats yet
  if (savedChats.length === 0) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#0B141A' }}>
        <View className='flex-1 items-center justify-center px-6'>
          <View className='bg-wa-header mb-6 h-36 w-36 items-center justify-center rounded-full'>
            <Ionicons name='chatbubbles' size={80} color='#00A884' />
          </View>

          <Text className='text-wa-text-primary mb-2 text-center text-[22px] font-bold'>
            WhatsApp Chat Renderer
          </Text>
          <Text className='text-wa-text-secondary mb-6 text-center text-sm leading-6'>
            Import a WhatsApp chat export (.zip) to view your conversations in a beautiful
            interface.
          </Text>

          <View className='mb-8 gap-3 self-stretch'>
            <StepItem number='1' text='Export a chat from WhatsApp' />
            <StepItem number='2' text='Choose the .zip file below' />
            <StepItem number='3' text='View your conversation' />
          </View>

          <TouchableOpacity
            className='bg-wa-accent flex-row items-center justify-center self-stretch rounded-xl px-6 py-4'
            onPress={handleImport}
            activeOpacity={0.7}
          >
            <Ionicons name='document-attach' size={24} color='#FFFFFF' style={{ marginRight: 8 }} />
            <Text className='text-base font-semibold text-white'>Import .zip File</Text>
          </TouchableOpacity>

          {error && (
            <View className='bg-wa-error/10 mt-4 flex-row items-center gap-2 rounded-lg p-3'>
              <Ionicons name='warning' size={20} color='#FF6B6B' />
              <Text className='text-wa-error flex-1 text-xs'>{error}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    )
  }

  // Chat list
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#0B141A' }}>
      <FlatList
        data={savedChats}
        keyExtractor={chatKeyExtractor}
        renderItem={renderChatItem}
        ItemSeparatorComponent={ListSeparator}
        contentContainerStyle={{ paddingBottom: insets.bottom + 88 }}
        ListFooterComponent={
          <Pressable
            className='mt-2 flex-row items-center justify-center gap-2 py-4'
            onPress={handleResetAll}
          >
            <Ionicons name='trash-outline' size={16} color='#FF6B6B' />
            <Text className='text-wa-error text-sm'>Reset All Chats</Text>
          </Pressable>
        }
      />

      {/* FAB */}
      <Pressable
        className='bg-wa-accent absolute right-5 h-14 w-14 items-center justify-center rounded-full'
        style={{
          bottom: insets.bottom + 16,
          elevation: 6,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 4
        }}
        onPress={handleImport}
      >
        <Ionicons name='add' size={28} color='#FFFFFF' />
      </Pressable>
    </SafeAreaView>
  )
}

const ListSeparator = () => <View className='bg-wa-divider ml-[72px] h-px' />

const StepItem = ({ number, text }: { number: string; text: string }) => {
  return (
    <View className='flex-row items-center gap-3'>
      <View className='bg-wa-accent h-8 w-8 items-center justify-center rounded-full'>
        <Text className='text-sm font-bold text-white'>{number}</Text>
      </View>
      <Text className='text-wa-text-primary flex-1 text-base'>{text}</Text>
    </View>
  )
}
