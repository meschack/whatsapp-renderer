import type { Message } from '@/models/types'

export type HapticFeedbackEvent = 'selection' | 'action' | 'scroll'

export function shouldPerformHapticFeedback(enabled: boolean, event: HapticFeedbackEvent): boolean {
  return enabled && event !== 'scroll'
}

const MEDIA_LABELS: Record<NonNullable<Message['mediaType']>, string> = {
  audio: 'Voice message',
  document: 'Document',
  image: 'Image',
  video: 'Video'
}

export function getMessageAccessibilityLabel(message: Message): string {
  const pieces = [message.isMine ? 'You' : (message.sender ?? 'Unknown sender')]
  if (message.mediaType) pieces.push(MEDIA_LABELS[message.mediaType])
  if (message.text?.trim()) pieces.push(message.text.trim())
  if (message.isEdited) pieces.push('Edited')
  pieces.push(
    message.timestamp.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    })
  )
  return pieces.map(piece => `${piece}.`).join(' ')
}
