import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, BackHandler, findNodeHandle, type View } from 'react-native'

export type ChatTool =
  | 'search'
  | 'media'
  | 'bookmarks'
  | 'calendar'
  | 'insights'
  | 'menu'
  | 'appearance'
/** One active tool, one Back policy; nested media viewers register after this handler. */
export function useChatTools() {
  const [activeTool, setActiveTool] = useState<ChatTool | null>(null)
  const active = useRef(activeTool)
  active.current = activeTool
  const returnFocus = useRef<View | null>(null)
  const closeTool = useCallback(() => {
    active.current = null
    setActiveTool(null)
    requestAnimationFrame(() => {
      if (active.current !== null) return
      const handle = findNodeHandle(returnFocus.current)
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle)
    })
  }, [])
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!active.current) return false
      closeTool()
      return true
    })
    return () => subscription.remove()
  }, [closeTool])
  const setters = useMemo(() => {
    const setter = (tool: ChatTool) => (next: boolean | ((previous: boolean) => boolean)) => {
      const open = typeof next === 'function' ? next(active.current === tool) : next
      if (open) {
        active.current = tool
        setActiveTool(tool)
      } else if (active.current === tool) closeTool()
    }
    return {
      setIsSearchOpen: setter('search'),
      setIsMediaLibraryOpen: setter('media'),
      setIsBookmarkBrowserOpen: setter('bookmarks'),
      setIsCalendarOpen: setter('calendar'),
      setIsInsightsOpen: setter('insights'),
      setIsToolsMenuOpen: setter('menu'),
      setIsAppearanceOpen: setter('appearance')
    }
  }, [closeTool])
  return {
    activeTool,
    returnFocus,
    closeTool,
    ...setters,
    isSearchOpen: activeTool === 'search',
    isMediaLibraryOpen: activeTool === 'media',
    isBookmarkBrowserOpen: activeTool === 'bookmarks',
    isCalendarOpen: activeTool === 'calendar',
    isInsightsOpen: activeTool === 'insights',
    isToolsMenuOpen: activeTool === 'menu',
    isAppearanceOpen: activeTool === 'appearance'
  }
}
