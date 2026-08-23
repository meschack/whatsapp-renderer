export interface Message {
  id: string
  sender: string | null
  text: string | null
  mediaType: 'image' | 'video' | 'audio' | 'document' | null
  mediaUri: string | null
  mediaFilename: string | null
  mediaSize: number | null
  mediaWidth: number | null
  mediaHeight: number | null
  mediaDuration: number | null
  mediaPreviewUri: string | null
  mediaWaveform: number[] | null
  timestamp: Date
  isEdited: boolean
  isMine: boolean
  isSystem: boolean
}

export type MediaType = NonNullable<Message['mediaType']>

export interface MediaAttachment {
  filename: string
  uri: string
  type: MediaType
  size: number
  width: number | null
  height: number | null
  duration: number | null
  previewUri: string | null
  waveform: number[] | null
}

export type MediaMap = Map<string, MediaAttachment>

export interface SavedChat {
  id: string
  chatName: string
  myName: string
  participants: string[]
  extractDirUri: string
  messageCount: number
  lastMessageText: string | null
  lastMessageTime: string
  importedAt: string
  archiveFingerprint?: string | null
  importDiagnostics?: ImportDiagnostics
  isPinned?: boolean
  isArchived?: boolean
  pinnedAt?: number | null
}

export type ImportDiagnosticCategory =
  | 'missing-files'
  | 'unsupported-formats'
  | 'ambiguous-dates'
  | 'malformed-records'
  | 'skipped-content'

export interface ImportDiagnostics {
  counts: Record<ImportDiagnosticCategory, number>
  samples: Record<ImportDiagnosticCategory, string[]>
}
