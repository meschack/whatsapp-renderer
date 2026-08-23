import type { Message } from '../models/types'

export interface MessageActionAvailability {
  copy: boolean
  share: boolean
  bookmark: boolean
  information: boolean
}

export interface MessageInfoRow {
  label: string
  value: string
}

export function getMessageActionAvailability(message: Message): MessageActionAvailability {
  const hasText = message.text !== null && message.text.trim().length > 0
  return {
    copy: hasText,
    share: hasText,
    bookmark: !message.isSystem,
    information: true
  }
}

export function buildMessageInfoRows(
  message: Message,
  formatTimestamp: (date: Date) => string = date => date.toLocaleString()
): MessageInfoRow[] {
  const rows: MessageInfoRow[] = [
    { label: 'Sender', value: message.sender ?? 'System' },
    { label: 'Timestamp', value: formatTimestamp(message.timestamp) },
    { label: 'Edited', value: message.isEdited ? 'Yes' : 'No' }
  ]

  if (message.mediaType) rows.push({ label: 'Type', value: message.mediaType })
  if (message.mediaFilename) rows.push({ label: 'Filename', value: message.mediaFilename })
  if (message.mediaSize !== null)
    rows.push({ label: 'Size', value: formatBytes(message.mediaSize) })
  if (message.mediaWidth !== null && message.mediaHeight !== null) {
    rows.push({ label: 'Dimensions', value: `${message.mediaWidth} × ${message.mediaHeight}` })
  }
  if (message.mediaDuration !== null) {
    rows.push({ label: 'Duration', value: formatDuration(message.mediaDuration) })
  }
  if (message.mediaType) {
    rows.push({ label: 'File', value: message.mediaUri ? 'Available' : 'Missing' })
  }

  return rows
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`
  return `${(bytes / 1_048_576).toFixed(1)} MB`
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`
}
