import { createContext, useContext } from 'react'
import type { ImportDiagnostics, SavedChat } from '@/models/types'

export interface ChatData {
  chatId: string
  participants: string[]
  chatName: string
  myName: string
  extractDirUri: string
  messageCount: number
  importedAt: string
  archiveFingerprint?: string | null
  importDiagnostics?: ImportDiagnostics
}

export interface ChatStore {
  chatData: ChatData | null
  setChatData: (data: ChatData | null) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
  error: string | null
  setError: (error: string | null) => void
  savedChats: SavedChat[]
  refreshSavedChats: () => void
}

export const ChatContext = createContext<ChatStore>({
  chatData: null,
  setChatData: () => {},
  isLoading: false,
  setIsLoading: () => {},
  error: null,
  setError: () => {},
  savedChats: [],
  refreshSavedChats: () => {}
})

export const useChatStore = () => useContext(ChatContext)
