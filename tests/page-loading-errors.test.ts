import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../store/message-database', () => ({
  getInitialMessagePage: vi.fn(),
  getOlderMessagePage: vi.fn(),
  getNewerMessagePage: vi.fn(),
  getInitialAttachmentPage: vi.fn(),
  getOlderAttachmentPage: vi.fn(),
  getNewerAttachmentPage: vi.fn()
}))
import { useMessagePages } from '../hooks/use-message-pages'
import { useAttachmentPages } from '../hooks/use-attachment-pages'
import type { TimelineRecord } from '../utils/chat-timeline'
let renderer: ReactTestRenderer | undefined
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount())
  renderer = undefined
  vi.restoreAllMocks()
})
const record = {
  sequence: 1,
  message: {
    id: 'msg-1',
    text: 'Keep this',
    sender: 'Alice',
    timestamp: new Date(),
    mediaType: null,
    isSystem: false
  }
} as TimelineRecord

describe('page failures and explicit retry', () => {
  it('distinguishes initial failure from an empty chat, and retries the same initial request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const initial = vi
      .fn()
      .mockRejectedValueOnce(new Error('disk read failed'))
      .mockResolvedValue({
        records: [record],
        hasOlder: false,
        hasNewer: false,
        restoredSequence: 1
      })
    const repository = { initial, older: vi.fn(), newer: vi.fn() }
    let pages!: ReturnType<typeof useMessagePages>
    function Harness() {
      pages = useMessagePages('chat', { repository })
      return null
    }
    await act(async () => {
      renderer = create(createElement(Harness))
    })
    expect(pages.loadError?.direction).toBe('initial')
    await act(async () => {
      pages.retry()
    })
    expect(pages.loadError).toBeNull()
    expect(pages.items.some(item => item.id === 'msg-1')).toBe(true)
    expect(initial).toHaveBeenCalledTimes(2)
  })
  it('keeps visible messages after a newer-page failure and prevents automatic retry storms', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const newer = vi
      .fn()
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValue({ records: [], hasMore: false })
    const repository = {
      initial: async () => ({
        records: [record],
        hasOlder: false,
        hasNewer: true,
        restoredSequence: 1
      }),
      older: vi.fn(),
      newer
    }
    let pages!: ReturnType<typeof useMessagePages>
    function Harness() {
      pages = useMessagePages('chat', { repository })
      return null
    }
    await act(async () => {
      renderer = create(createElement(Harness))
    })
    await act(async () => {
      await pages.loadNewer()
      await pages.loadNewer()
    })
    expect(pages.loadError?.direction).toBe('newer')
    expect(newer).toHaveBeenCalledTimes(1)
    expect(pages.items.some(item => item.id === 'msg-1')).toBe(true)
    await act(async () => {
      pages.retry()
    })
    expect(newer).toHaveBeenCalledTimes(2)
    expect(pages.loadError).toBeNull()
  })
  it('exposes failed media loading rather than reporting no photos', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const initial = vi
      .fn()
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValue({ records: [], hasOlder: false, hasNewer: false, restoredSequence: null })
    const repository = { initial, older: vi.fn(), newer: vi.fn() }
    let pages!: ReturnType<typeof useAttachmentPages>
    function Harness() {
      pages = useAttachmentPages('chat', 'image', { repository })
      return null
    }
    await act(async () => {
      renderer = create(createElement(Harness))
    })
    expect(pages.loadError?.direction).toBe('initial')
    await act(async () => {
      pages.retry()
    })
    expect(pages.loadError).toBeNull()
    expect(initial).toHaveBeenCalledTimes(2)
  })
})
