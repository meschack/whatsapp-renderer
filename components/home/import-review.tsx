import { Pressable, ScrollView, Text, View } from '@/src/tw'
import type { ChatImportPreview } from '@/utils/chat-import-workflow'

export function ImportReview({
  preview,
  onAccept,
  onCancel
}: {
  preview: ChatImportPreview
  onAccept(): void
  onCancel(): void
}) {
  return (
    <ScrollView
      testID='import-review'
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
            : preview.targetChat
              ? 'Shared message history identifies this conversation. Your saved chat and bookmarks will be kept.'
              : 'This export will create a separate chat. Existing conversations will be kept.'}
      </Text>
      <View className='bg-wa-header gap-2 rounded-xl p-4'>
        <Text className='text-wa-text-primary'>
          {preview.messageCount.toLocaleString()} messages in the export
        </Text>
        <Text className='text-wa-text-primary'>
          {preview.newMessageCount.toLocaleString()} new messages
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
