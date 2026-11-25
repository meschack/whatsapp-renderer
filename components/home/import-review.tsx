import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from '@/src/tw'
import type { ChatImportPreview } from '@/utils/chat-import-workflow'

export function ImportReview({
  preview,
  onChooseChat,
  onAccept,
  onCancel
}: {
  preview: ChatImportPreview
  onChooseChat?(chatId: string): void
  onAccept(): void
  onCancel(): void
}) {
  const [choosingChat, setChoosingChat] = useState(false)
  const [search, setSearch] = useState('')
  const choices =
    preview.availableChats?.filter(chat =>
      chat.chatName.toLocaleLowerCase().includes(search.toLocaleLowerCase())
    ) ?? []
  return (
    <ScrollView
      testID='import-review'
      keyboardShouldPersistTaps='handled'
      contentContainerClassName='gap-4 p-6'
      style={{ width: '100%', maxWidth: 680 }}
    >
      <Text accessibilityRole='header' className='text-wa-text-primary text-2xl font-bold'>
        {preview.repairOnly
          ? 'Review attachment repair'
          : preview.targetChat
            ? 'Review chat update'
            : 'Review import'}
      </Text>
      <Text className='text-wa-text-primary text-lg font-medium'>{preview.chatName}</Text>
      <Text className='text-wa-text-secondary'>
        {preview.repairOnly
          ? 'Matching missing attachments will be restored while keeping saved messages and bookmarks.'
          : preview.outcome === 'up-to-date'
            ? 'This export is already in your archive. Nothing will be changed.'
            : preview.manualTarget
              ? 'You chose this conversation. Exact duplicate messages will be skipped, and messages will be combined in date order. Saved chat settings and bookmarks will be kept.'
              : preview.targetChat
                ? 'Shared message history identifies this conversation. Your saved chat and bookmarks will be kept.'
                : 'This export will create a separate chat. Existing conversations will be kept.'}
      </Text>
      <View className='bg-wa-header gap-2 rounded-xl p-4'>
        <Text className='text-wa-text-primary'>
          {preview.messageCount.toLocaleString()} messages in the export
        </Text>
        <Text className='text-wa-text-primary'>
          {preview.newMessageCount.toLocaleString()}{' '}
          {preview.manualTarget ? 'messages to check for duplicates' : 'new messages'}
        </Text>
        <Text className='text-wa-text-primary'>
          {preview.mediaCount.toLocaleString()} media files to prepare
        </Text>
        {preview.reconciliation && (
          <Text className='text-wa-text-primary'>
            The latest stored message will be reconciled with its edited version.
          </Text>
        )}
      </View>
      {preview.ambiguousDateCount > 0 && (
        <Text className='text-wa-error'>
          {preview.ambiguousDateCount} ambiguous dates were found. The import report will record how
          they were interpreted.
        </Text>
      )}
      {preview.ambiguousMedia.length > 0 && (
        <View className='bg-wa-header gap-2 rounded-xl p-4'>
          <Text className='text-wa-error'>
            Some filenames refer to several files. These attachments will be marked unavailable
            rather than linked to the wrong file.
          </Text>
          {preview.ambiguousMedia.map(item => (
            <Text key={item.filename} className='text-wa-text-secondary'>
              {item.filename}: {item.relativePaths.join(', ')}
            </Text>
          ))}
        </View>
      )}
      {Boolean(preview.availableChats?.length && onChooseChat) && (
        <View className='gap-3'>
          <Pressable
            testID='import-review-choose-chat'
            accessibilityRole='button'
            accessibilityState={{ expanded: choosingChat }}
            className='border-wa-accent min-h-12 items-center justify-center rounded-xl border px-4'
            onPress={() => setChoosingChat(value => !value)}
          >
            <Text className='text-wa-text-primary'>Add to an existing chat instead</Text>
          </Pressable>
          {choosingChat && (
            <View className='gap-2'>
              <Text className='text-wa-text-secondary'>
                Choose the conversation this export belongs to. You can review before applying it.
              </Text>
              <TextInput
                accessibilityLabel='Search saved chats'
                placeholder='Search saved chats'
                value={search}
                onChangeText={setSearch}
                className='text-wa-text-primary bg-wa-header min-h-12 rounded-xl px-4'
              />
              {choices.map(chat => (
                <Pressable
                  key={chat.id}
                  accessibilityRole='button'
                  accessibilityLabel={`Add export to ${chat.chatName}`}
                  className='bg-wa-header min-h-12 justify-center rounded-xl px-4 py-3'
                  onPress={() => onChooseChat?.(chat.id)}
                >
                  <Text className='text-wa-text-primary'>{chat.chatName}</Text>
                  <Text className='text-wa-text-secondary text-sm'>
                    {chat.messageCount.toLocaleString()} messages · {chat.participants.join(', ')}
                    {chat.isArchived ? ' · Archived' : ''}
                  </Text>
                </Pressable>
              ))}
              {choices.length === 0 && (
                <Text className='text-wa-text-secondary'>No chats found.</Text>
              )}
            </View>
          )}
        </View>
      )}
      <Pressable
        testID='import-review-confirm'
        accessibilityRole='button'
        accessibilityLabel={preview.outcome === 'up-to-date' ? 'Open saved chat' : 'Confirm import'}
        className='bg-wa-accent min-h-12 items-center justify-center rounded-xl px-5'
        onPress={onAccept}
      >
        <Text className='text-wa-on-accent font-medium'>
          {preview.outcome === 'up-to-date'
            ? 'Open saved chat'
            : preview.repairOnly
              ? 'Restore missing media'
              : preview.targetChat
                ? 'Apply update'
                : 'Import chat'}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole='button'
        accessibilityLabel='Cancel import review'
        className='min-h-12 items-center justify-center'
        onPress={onCancel}
      >
        <Text className='text-wa-text-secondary'>Cancel</Text>
      </Pressable>
    </ScrollView>
  )
}
