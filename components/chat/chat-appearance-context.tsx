import {
  DEFAULT_CHAT_APPEARANCE,
  getEffectiveChatTextScale,
  type ChatAppearancePreference
} from '@/utils/chat-appearance'
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'
import { Platform } from 'react-native'

interface RenderedChatAppearance {
  wallpaper: ChatAppearancePreference['wallpaper']
  textScale: number
}

const ChatAppearanceContext = createContext<RenderedChatAppearance>(DEFAULT_CHAT_APPEARANCE)

export function ChatAppearanceProvider({
  value,
  children
}: PropsWithChildren<{ value: ChatAppearancePreference }>) {
  const renderedValue = useMemo<RenderedChatAppearance>(
    () => ({
      wallpaper: value.wallpaper,
      textScale: getEffectiveChatTextScale(value.textScale, Platform.OS)
    }),
    [value.textScale, value.wallpaper]
  )

  return (
    <ChatAppearanceContext.Provider value={renderedValue}>
      {children}
    </ChatAppearanceContext.Provider>
  )
}

export function useChatAppearance(): RenderedChatAppearance {
  return useContext(ChatAppearanceContext)
}
