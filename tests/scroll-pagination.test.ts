import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-native', () => ({ I18nManager: { isRTL: false } }))
const platformConfig = vi.hoisted(() => ({ supportsOffsetCorrection: false }))
vi.mock('../node_modules/@shopify/flash-list/src/native/config/PlatformHelper', () => ({
  PlatformConfig: platformConfig
}))
vi.mock('../store/message-database', () => ({
  getInitialMessagePage: vi.fn(),
  getOlderMessagePage: vi.fn(),
  getNewerMessagePage: vi.fn()
}))

import { useMessagePages } from '../hooks/use-message-pages'
const flashListControllerPath =
  '../node_modules/@shopify/flash-list/src/recyclerview/hooks/useRecyclerViewController.tsx'
const { useRecyclerViewController } = await import(flashListControllerPath)
import type { TimelineRecord } from '../utils/chat-timeline'

// Exercise the real page loader and FlashList's actual offset correction hook.
// Fixed row geometry keeps the viewport deterministic while native scrolling is represented by offset.
const records = (start: number, count: number): TimelineRecord[] =>
  Array.from({ length: count }, (_, i) => ({
    sequence: start + i,
    message: {
      id: `msg-${start + i}`,
      sender: 'Alice',
      text: `message ${start + i}`,
      timestamp: new Date(2026, 7, 1),
      isSystem: false,
      isMine: false,
      isEdited: false,
      mediaType: null,
      mediaUri: null,
      mediaFilename: null,
      mediaSize: null,
      mediaWidth: null,
      mediaHeight: null,
      mediaDuration: null,
      mediaPreviewUri: null,
      mediaWaveform: null
    }
  }))

let renderer: ReactTestRenderer | undefined
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount())
  renderer = undefined
})

describe('long-chat pagination preserves the visible message', () => {
  it.each([false, true])(
    'preserves a same-sized paged window (native anchor=%s)',
    async nativeAnchor => {
      platformConfig.supportsOffsetCorrection = nativeAnchor
      let pages!: ReturnType<typeof useMessagePages>
      let controller!: ReturnType<typeof useRecyclerViewController>
      let offset = 400
      let managerOffset = 400
      let data: { id: string; sequence: number }[] = []
      const repository = {
        initial: async () => ({
          records: records(1, 6),
          hasOlder: false,
          hasNewer: true,
          restoredSequence: 1
        }),
        older: async () => ({ records: [], hasMore: false }),
        newer: async () => ({ records: records(7, 2), hasMore: true })
      }
      const manager = {
        props: { data, horizontal: false },
        isInitialScrollComplete: true,
        getDataLength: () => data.length,
        getIsFirstLayoutComplete: () => true,
        hasStableDataKeys: () => true,
        shouldMaintainVisibleContentPosition: () => true,
        computeVisibleIndices: () => ({ startIndex: Math.floor(managerOffset / 100) }),
        getDataKey: (i: number) => data[i]?.id,
        getLayout: (i: number) => ({ x: 0, y: i * 100, width: 300, height: 100 }),
        getEngagedIndices: () => ({
          findValue: (match: (i: number) => boolean) => [4, 5].find(match)
        }),
        getAbsoluteLastScrollOffset: () => managerOffset,
        updateScrollOffset: (next: number) => {
          managerOffset = next
          return undefined
        },
        ignoreScrollEvents: false
      }
      const scroll = {
        current: {
          scrollTo: ({ y }: { y: number }) => {
            offset = y
          }
        }
      }
      function Harness() {
        pages = useMessagePages('chat', { pageSize: 2, maxMessages: 6, repository })
        data = pages.items.filter(item => item.type === 'message') as typeof data
        manager.props.data = data
        controller = useRecyclerViewController(
          manager as never,
          null,
          scroll as never,
          {
            current: {
              scrollBy: (difference: number) => {
                offset += difference
              }
            }
          } as never
        )
        return null
      }
      await act(async () => {
        renderer = create(createElement(Harness))
      })
      await act(async () => {
        controller.applyOffsetCorrection()
      })
      controller.computeFirstVisibleIndexForOffsetCorrection()
      expect(data[Math.floor(offset / 100)].id).toBe('msg-5')
      await act(async () => {
        await pages.loadNewer()
      })
      await act(async () => {
        controller.applyOffsetCorrection()
      })
      expect(data[Math.floor(offset / 100)].id).toBe('msg-5')
      expect(offset).toBe(200)
    }
  )
})
