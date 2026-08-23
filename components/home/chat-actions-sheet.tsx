import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState } from 'react'
import { Modal } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { SavedChat } from '@/models/types'
import { Pressable, Text, TextInput, View } from '@/src/tw'
import { normalizeChatName } from '@/utils/chat-library'

interface ChatActionsSheetProps {
  chat: SavedChat | null
  onClose(): void
  onRename(name: string): void
  onTogglePinned(): void
  onToggleArchived(): void
  onDelete(): void
}

export function ChatActionsSheet({
  chat,
  onClose,
  onRename,
  onTogglePinned,
  onToggleArchived,
  onDelete
}: ChatActionsSheetProps) {
  const insets = useSafeAreaInsets()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRenaming(false)
    setName(chat?.chatName ?? '')
    setError(null)
  }, [chat?.id, chat?.chatName])

  if (!chat) return null

  const submitRename = () => {
    const result = normalizeChatName(name)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onRename(result.value)
  }

  return (
    <Modal visible transparent animationType='slide' statusBarTranslucent onRequestClose={onClose}>
      <Pressable className='flex-1 justify-end bg-black/55' onPress={onClose}>
        <Pressable
          accessibilityViewIsModal
          className='rounded-t-[24px] bg-[#202C33] px-4 pt-3'
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          onPress={event => event.stopPropagation()}
        >
          <View className='mb-3 h-1 w-10 self-center rounded-full bg-[#667781]' />
          {renaming ? (
            <>
              <View className='mb-3 flex-row items-center'>
                <Pressable
                  accessibilityLabel='Back to chat actions'
                  className='size-12 items-center justify-center rounded-full active:bg-white/10'
                  onPress={() => setRenaming(false)}
                >
                  <Ionicons name='arrow-back' size={22} color='#E9EDEF' />
                </Pressable>
                <Text className='ml-1 text-[17px] font-medium text-[#E9EDEF]'>Rename chat</Text>
              </View>
              <TextInput
                accessibilityLabel='Chat name'
                autoFocus
                value={name}
                maxLength={81}
                onChangeText={value => {
                  setName(value)
                  setError(null)
                }}
                onSubmitEditing={submitRename}
                returnKeyType='done'
                selectionColor='#00A884'
                className='h-12 rounded-xl border border-white/10 bg-[#111B21] px-4 text-[16px] text-[#E9EDEF]'
              />
              {error ? <Text className='mt-2 text-[12px] text-[#FF6B6B]'>{error}</Text> : null}
              <Pressable
                accessibilityRole='button'
                className='mt-4 min-h-12 items-center justify-center rounded-full bg-[#00A884] active:opacity-80'
                onPress={submitRename}
              >
                <Text className='font-medium text-[#071A16]'>Save name</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text className='mb-2 px-3 text-[13px] text-[#8696A0]' numberOfLines={1}>
                {chat.chatName}
              </Text>
              <ActionRow icon='pencil-outline' label='Rename' onPress={() => setRenaming(true)} />
              <ActionRow
                icon={chat.isPinned ? 'pin-outline' : 'pin'}
                label={chat.isPinned ? 'Unpin' : 'Pin to top'}
                onPress={onTogglePinned}
              />
              <ActionRow
                icon={chat.isArchived ? 'arrow-undo-outline' : 'archive-outline'}
                label={chat.isArchived ? 'Restore to chats' : 'Archive'}
                onPress={onToggleArchived}
              />
              <ActionRow destructive icon='trash-outline' label='Delete chat…' onPress={onDelete} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function ActionRow({
  icon,
  label,
  destructive = false,
  onPress
}: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  destructive?: boolean
  onPress(): void
}) {
  const color = destructive ? '#FF6B6B' : '#E9EDEF'
  return (
    <Pressable
      accessibilityRole='button'
      className='min-h-12 flex-row items-center rounded-xl px-3 active:bg-white/10'
      onPress={onPress}
    >
      <View className='w-10 items-start'>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text className='text-[15px]' style={{ color }}>
        {label}
      </Text>
    </Pressable>
  )
}
