import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatSearch } from '../components/chat/chat-search'
import { BookmarkBrowser } from '../components/chat/bookmark-browser'

const mocked = vi.hoisted(() => ({
  search: vi.fn(),
  bookmarks: vi.fn(),
  focus: vi.fn(),
  announce: vi.fn()
}))
vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  FlatList: 'FlatList',
  AccessibilityInfo: {
    setAccessibilityFocus: mocked.focus,
    announceForAccessibility: mocked.announce
  },
  findNodeHandle: () => 42
}))
vi.mock('@shopify/flash-list', () => ({ FlashList: 'FlashList' }))
vi.mock('@/src/tw', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('@/components/shared/themed-icon', () => ({ ThemedIonicons: 'Icon' }))
vi.mock('@/components/settings/app-appearance-provider', () => ({
  useAppAppearance: () => ({ colors: {} })
}))
vi.mock('@/store/message-database', () => ({
  searchMessages: mocked.search,
  getBookmarkPage: mocked.bookmarks
}))

let renderer: ReactTestRenderer | undefined
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
})
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount())
  renderer = undefined
  vi.useRealTimers()
})
const host = (name: string) =>
  renderer!.root.find(node => typeof node.type === 'string' && node.type === name)
const message = {
  messageId: 'm10',
  sequence: 10,
  sender: 'Alice',
  excerpt: 'anchor',
  timestamp: new Date(2026, 7, 23)
}

describe('reader tool recovery', () => {
  it('preserves search results on page failure, suppresses automatic requests, and retries the failed cursor', async () => {
    mocked.search
      .mockResolvedValueOnce({ results: [message], hasMore: true })
      .mockRejectedValueOnce(new Error('Cannot read next search page'))
      .mockResolvedValueOnce({
        results: [{ ...message, sequence: 11, messageId: 'm11' }],
        hasMore: false
      })
    await act(async () => {
      renderer = create(createElement(ChatSearch, { chatId: 'chat', onClose() {}, onSelect() {} }))
    })
    await act(async () => {
      host('TextInput').props.onChangeText('anchor')
    })
    await act(async () => {
      vi.advanceTimersByTime(300)
    })
    const list = () => host('FlatList')
    await act(async () => {
      list().props.onEndReached()
    })
    expect(list().props.data).toEqual([message])
    expect(list().props.ListFooterComponent.props.message).toBe('Cannot read next search page')
    expect(mocked.announce).toHaveBeenCalledWith('Cannot read next search page')
    await act(async () => {
      list().props.onEndReached()
    })
    expect(mocked.search).toHaveBeenCalledTimes(2)
    await act(async () => {
      list().props.ListFooterComponent.props.onRetry()
    })
    expect(mocked.search).toHaveBeenLastCalledWith('chat', 'anchor', 30, 10)
    expect(list().props.data.map((item: { sequence: number }) => item.sequence)).toEqual([10, 11])
    expect(list().props.ListFooterComponent).toBeNull()
  })

  it('distinguishes failed bookmark reads from empty bookmarks and retries initial loading', async () => {
    mocked.bookmarks
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValueOnce({ records: [message], nextCursor: null, hasMore: false })
    await act(async () => {
      renderer = create(
        createElement(BookmarkBrowser, { chatId: 'chat', onClose() {}, onJump() {} })
      )
    })
    const list = () => host('FlashList')
    expect(list().props.ListEmptyComponent.props.message).toBe('Bookmarks could not be loaded.')
    await act(async () => {
      list().props.ListEmptyComponent.props.onRetry()
    })
    expect(mocked.bookmarks).toHaveBeenLastCalledWith('chat', null, 40)
    expect(list().props.data).toEqual([message])
  })

  it('keeps bookmark records and the failed page cursor available for explicit retry', async () => {
    const cursor = { sequence: 10, bookmarkedAt: 100 }
    mocked.bookmarks
      .mockResolvedValueOnce({ records: [message], nextCursor: cursor, hasMore: true })
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValueOnce({ records: [], nextCursor: null, hasMore: false })
    await act(async () => {
      renderer = create(
        createElement(BookmarkBrowser, { chatId: 'chat', onClose() {}, onJump() {} })
      )
    })
    const list = () => host('FlashList')
    await act(async () => {
      list().props.onEndReached()
    })
    expect(list().props.data).toEqual([message])
    await act(async () => {
      list().props.onEndReached()
    })
    expect(mocked.bookmarks).toHaveBeenCalledTimes(2)
    await act(async () => {
      list().props.ListFooterComponent.props.onRetry()
    })
    expect(mocked.bookmarks).toHaveBeenLastCalledWith('chat', cursor, 40)
  })

  it('focuses the close control once, even when a tool error causes rerenders', async () => {
    mocked.bookmarks
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValueOnce({ records: [], nextCursor: null, hasMore: false })
    await act(async () => {
      renderer = create(
        createElement(BookmarkBrowser, { chatId: 'chat', onClose() {}, onJump() {} }),
        { createNodeMock: () => ({}) }
      )
    })
    await act(async () => {
      vi.advanceTimersByTime(150)
    })
    expect(mocked.focus).toHaveBeenCalledExactlyOnceWith(42)
    await act(async () => {
      host('FlashList').props.ListEmptyComponent.props.onRetry()
    })
    await act(async () => {
      vi.advanceTimersByTime(150)
    })
    expect(mocked.focus).toHaveBeenCalledTimes(1)
  })
})
