import { useChatStore } from '@/store/chat-store'
import { saveChatMetadata } from '@/store/chat-database'
import { updateIsMine, getLastMessage } from '@/store/message-database'
import { View, Text, Pressable } from '@/src/tw'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { FlatList } from 'react-native'

export default function SelectSenderScreen() {
  const router = useRouter()
  const { chatData, setChatData, refreshSavedChats } = useChatStore()

  if (!chatData) {
    return (
      <View className='flex-1 bg-wa-bg justify-center items-center'>
        <Text className='text-wa-text-secondary text-base text-center mt-10'>No chat data loaded.</Text>
      </View>
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
      lastMessageTime: lastMsg ? new Date(lastMsg.timestamp).toISOString() : new Date().toISOString(),
      importedAt: new Date().toISOString()
    })

    refreshSavedChats()

    router.dismiss()
    setTimeout(() => {
      router.push('/chat')
    }, 100)
  }

  return (
    <View className='flex-1 bg-wa-bg pt-6'>
      <Text className='text-lg font-bold text-wa-text-primary text-center mb-2'>Select Your Name</Text>
      <Text className='text-sm text-wa-text-secondary text-center mb-6 px-6'>
        Choose which participant you are in this conversation.
      </Text>

      <FlatList
        data={chatData.participants}
        keyExtractor={item => item}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <Pressable className='flex-row items-center py-4 px-3 gap-3' onPress={() => handleSelect(item)}>
            <View className='w-11 h-11 rounded-full bg-wa-header justify-center items-center'>
              <Ionicons name='person' size={24} color='#8696A0' />
            </View>
            <Text className='flex-1 text-base text-wa-text-primary font-medium'>{item}</Text>
            <Ionicons name='chevron-forward' size={20} color='#8696A0' />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View className='h-px bg-wa-divider ml-[68px]' />}
      />
    </View>
  )
}
