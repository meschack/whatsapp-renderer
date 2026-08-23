import { useChatStore } from '@/store/chat-store'
import { saveChatMetadata } from '@/store/chat-database'
import { updateIsMine, getLastMessage } from '@/store/message-database'
import { View, Text, Pressable } from '@/src/tw'
import { Ionicons } from '@expo/vector-icons'
import { GeneratedAvatar } from '@/components/shared/generated-avatar'
import { buildParticipantColorMap } from '@/utils/participant-identity'
import { useMemo } from 'react'
import { useRouter } from 'expo-router'
import { FlatList } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function SelectSenderScreen() {
  const router = useRouter()
  const { chatData, setChatData, refreshSavedChats } = useChatStore()
  const participantColors = useMemo(
    () => buildParticipantColorMap(chatData?.participants ?? []),
    [chatData?.participants]
  )

  if (!chatData) {
    return (
      <SafeAreaView
        edges={['bottom']}
        style={{
          flex: 1,
          backgroundColor: '#0B141A',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Text className='text-wa-text-secondary mt-10 text-center text-base'>
          No chat data loaded.
        </Text>
      </SafeAreaView>
    )
  }

  const handleSelect = (name: string) => {
    // Update isMine flag in SQLite with a single UPDATE query
    updateIsMine(chatData.chatId, name)

    const updatedChatData = {
      ...chatData,
      myName: name
    }

    setChatData(updatedChatData)

    // Get last message info from SQLite for metadata
    const lastMsg = getLastMessage(chatData.chatId)

    saveChatMetadata({
      id: chatData.chatId,
      chatName: chatData.chatName,
      myName: name,
      participants: chatData.participants,
      extractDirUri: chatData.extractDirUri,
      messageCount: chatData.messageCount,
      lastMessageText: lastMsg?.text ?? null,
      lastMessageTime: lastMsg
        ? new Date(lastMsg.timestamp).toISOString()
        : new Date().toISOString(),
      importedAt: chatData.importedAt,
      archiveFingerprint: chatData.archiveFingerprint,
      importDiagnostics: chatData.importDiagnostics
    })

    refreshSavedChats()

    router.dismiss()
    setTimeout(() => {
      router.push('/chat')
    }, 100)
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: '#0B141A' }}>
      <View className='pt-6'>
        <Text className='text-wa-text-primary mb-2 text-center text-lg font-bold'>
          Select Your Name
        </Text>
        <Text className='text-wa-text-secondary mb-6 px-6 text-center text-sm'>
          Choose which participant you are in this conversation.
        </Text>
      </View>
      <FlatList
        data={chatData.participants}
        keyExtractor={item => item}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Select ${item} as me`}
            accessibilityRole='button'
            className='flex-row items-center gap-3 px-3 py-4'
            onPress={() => handleSelect(item)}
          >
            <GeneratedAvatar name={item} color={participantColors[item]} size={44} />
            <Text className='text-wa-text-primary flex-1 text-base font-medium'>{item}</Text>
            <Ionicons name='chevron-forward' size={20} color='#8696A0' />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View className='bg-wa-divider ml-[68px] h-px' />}
      />
    </SafeAreaView>
  )
}
