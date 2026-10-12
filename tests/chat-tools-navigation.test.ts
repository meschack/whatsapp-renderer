import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
const native = vi.hoisted(() => ({
  back: null as (() => boolean) | null,
  focus: vi.fn(),
  remove: vi.fn()
}))
vi.mock('react-native', () => ({
  BackHandler: {
    addEventListener: (_: string, handler: () => boolean) => {
      native.back = handler
      return { remove: native.remove }
    }
  },
  AccessibilityInfo: { setAccessibilityFocus: native.focus },
  findNodeHandle: () => 42
}))
import { useChatTools } from '../hooks/use-chat-tools'
let renderer: ReactTestRenderer | undefined
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount())
  renderer = undefined
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
describe('reader tool navigation and focus', () => {
  it('keeps one active tool and lets Back leave the chat only after closing it', async () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    let tools!: ReturnType<typeof useChatTools>
    function Harness() {
      tools = useChatTools()
      tools.returnFocus.current = {} as never
      return null
    }
    await act(async () => {
      renderer = create(createElement(Harness))
    })
    await act(() => tools.setIsSearchOpen(true))
    await act(() => tools.setIsCalendarOpen(true))
    expect(tools.isSearchOpen).toBe(false)
    expect(tools.isCalendarOpen).toBe(true)
    await act(() => {
      expect(native.back!()).toBe(true)
    })
    expect(tools.activeTool).toBeNull()
    expect(native.back!()).toBe(false)
    frames.forEach(callback => callback(0))
    expect(native.focus).toHaveBeenCalledWith(42)
  })
  it('does not steal focus back to the timeline when a menu opens another tool', async () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    let tools!: ReturnType<typeof useChatTools>
    function Harness() {
      tools = useChatTools()
      tools.returnFocus.current = {} as never
      return null
    }
    await act(async () => {
      renderer = create(createElement(Harness))
    })
    await act(() => tools.setIsToolsMenuOpen(true))
    await act(() => {
      tools.setIsToolsMenuOpen(false)
      tools.setIsMediaLibraryOpen(true)
    })
    frames.forEach(callback => callback(0))
    expect(tools.isMediaLibraryOpen).toBe(true)
    expect(native.focus).not.toHaveBeenCalled()
  })
})
