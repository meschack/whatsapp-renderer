import { ActivityIndicator, BackHandler } from 'react-native'
import { useEffect } from 'react'

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

  const isLoading = isInitialLoading || records.length === 0
  useEffect(() => {
    if (!isLoading) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => subscription.remove()
  }, [isLoading, onClose])

  if (isLoading) {
    return (
      <View className='absolute inset-0 z-50 items-center justify-center bg-black'>
        <ActivityIndicator color='#FFFFFF' />
      </View>
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
