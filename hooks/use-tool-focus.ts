import { useEffect, useRef } from 'react'
import { AccessibilityInfo, findNodeHandle, type View } from 'react-native'

/** Focus a real close control once when a reader tool mounts; announce recoverable errors. */
export function useToolFocus(error?: string | null) {
  const closeRef = useRef<View>(null)
  useEffect(() => {
    const timer = setTimeout(() => {
      const handle = closeRef.current ? findNodeHandle(closeRef.current) : null
      if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle)
    }, 100)
    return () => clearTimeout(timer)
  }, [])
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error)
  }, [error])
  return closeRef
}
