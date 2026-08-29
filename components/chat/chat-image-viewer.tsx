import { ActivityIndicator, Modal } from 'react-native'

import { useAttachmentPages } from '@/hooks/use-attachment-pages'
import { View } from '@/src/tw'
import type { AttachmentRecord } from '@/utils/media-library'
import { MediaViewer } from './media-viewer'

interface ChatImageViewerProps {
  chatId: string
  chatName: string
  initialSequence: number
  onClose(): void
  onJump(record: AttachmentRecord): void
}

export function ChatImageViewer({
  chatId,
  chatName,
  initialSequence,
  onClose,
  onJump
}: ChatImageViewerProps) {
  const { records, hasOlder, hasNewer, isInitialLoading, restoredSequence, loadOlder, loadNewer } =
    useAttachmentPages(chatId, 'image', { initialSequence, pageSize: 31 })

  if (isInitialLoading || records.length === 0) {
    return (
      <Modal visible animationType='fade' statusBarTranslucent onRequestClose={onClose}>
        <View className='flex-1 items-center justify-center bg-black'>
          <ActivityIndicator color='#FFFFFF' />
        </View>
      </Modal>
    )
  }

  return (
    <MediaViewer
      title={chatName}
      records={records}
      initialSequence={restoredSequence ?? initialSequence}
      hasOlder={hasOlder}
      hasNewer={hasNewer}
      loadOlder={loadOlder}
      loadNewer={loadNewer}
      onClose={onClose}
      onJump={onJump}
    />
  )
}
