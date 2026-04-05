export interface Message {
  id: string
  sender: string | null
  text: string | null
  mediaType: 'image' | 'video' | 'audio' | 'document' | null
  mediaUri: string | null
  timestamp: Date
  isEdited: boolean
  isMine: boolean
  isSystem: boolean
}

export type MediaMap = Map<string, string>

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
}
