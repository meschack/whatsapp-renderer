import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useToolQuery } from '../hooks/use-tool-query'

let renderer: ReactTestRenderer | undefined
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(async () => {
  if (renderer) await act(() => renderer!.unmount())
  renderer = undefined
})

describe('calendar/insights tool queries', () => {
  it('keeps loaded data through a retry failure and recovers without false empty state', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce(['day'])
      .mockRejectedValueOnce(new Error('busy'))
      .mockResolvedValueOnce(['updated day'])
    let result!: ReturnType<typeof useToolQuery<string[]>>
    function Harness() {
      result = useToolQuery('chat', load, 'Read failed')
      return null
    }
    await act(async () => {
      renderer = create(createElement(Harness))
    })
    await act(async () => {
      result.retry()
    })
    expect(result.data).toEqual(['day'])
    expect(result.error).toBe('Read failed')
    await act(async () => {
      result.retry()
    })
    expect(result.data).toEqual(['updated day'])
    expect(result.error).toBeNull()
  })

  it('ignores a stale chat read after switching the tool to another chat', async () => {
    let resolveFirst!: (value: string[]) => void
    const load = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string[]>(resolve => {
            resolveFirst = resolve
          })
      )
      .mockResolvedValueOnce(['second chat'])
    let result!: ReturnType<typeof useToolQuery<string[]>>
    function Harness({ chatId }: { chatId: string }) {
      result = useToolQuery(chatId, load, 'Read failed')
      return null
    }
    await act(async () => {
      renderer = create(createElement(Harness, { chatId: 'first' }))
    })
    await act(async () => {
      renderer!.update(createElement(Harness, { chatId: 'second' }))
    })
    await act(async () => {
      resolveFirst(['stale first chat'])
    })
    expect(result.data).toEqual(['second chat'])
  })
})
