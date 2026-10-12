import {
  DEFAULT_CHAT_APPEARANCE,
  getEffectiveChatTextScale,
  resolveChatTextScale,
  type ChatAppearancePreference
} from '@/utils/chat-appearance'
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react'
import { Platform } from 'react-native'
import { useAppAppearance } from '@/components/settings/app-appearance-provider'

interface RenderedChatAppearance {
  wallpaper: ChatAppearancePreference['wallpaper']
  textScale: number
}

const ChatAppearanceContext = createContext<RenderedChatAppearance>(DEFAULT_CHAT_APPEARANCE)

export function ChatAppearanceProvider({
  value,
  children
}: PropsWithChildren<{ value: ChatAppearancePreference }>) {
  const { defaultTextScale } = useAppAppearance()
  const renderedValue = useMemo<RenderedChatAppearance>(
    () => ({
      wallpaper: value.wallpaper,
      textScale: getEffectiveChatTextScale(
        resolveChatTextScale(value, defaultTextScale),
        Platform.OS
      )
    }),
    [value, defaultTextScale]
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
