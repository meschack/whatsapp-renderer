import { DEFAULT_CHAT_APPEARANCE, type ChatAppearancePreference } from '@/utils/chat-appearance'
import { createContext, useContext } from 'react'

const ChatAppearanceContext = createContext<ChatAppearancePreference>(DEFAULT_CHAT_APPEARANCE)

export const ChatAppearanceProvider = ChatAppearanceContext.Provider

export function useChatAppearance(): ChatAppearancePreference {
  return useContext(ChatAppearanceContext)
}
