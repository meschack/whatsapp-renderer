import { describe, expect, it } from 'vitest'
import { beginArchiveOperation, resetAfterArchiveOperations } from '../utils/archive-operations'
describe('exclusive archive recovery', () => {
  it('cancels and drains an in-flight writer before deleting data or allowing new writers', async () => {
    const controller = new AbortController()
    const finish = beginArchiveOperation(controller)
    let reset = false
    const pending = resetAfterArchiveOperations(async () => {
      reset = true
    })
    expect(controller.signal.aborted).toBe(true)
    expect(reset).toBe(false)
    expect(() => beginArchiveOperation(new AbortController())).toThrow('being reset')
    finish()
    await pending
    expect(reset).toBe(true)
    const finishNew = beginArchiveOperation(new AbortController())
    finishNew()
  })
  it('releases the recovery barrier after deletion fails while preserving the error', async () => {
    await expect(
      resetAfterArchiveOperations(async () => {
        throw new Error('Disk unavailable')
      })
    ).rejects.toThrow('Disk unavailable')
    beginArchiveOperation(new AbortController())()
  })
})
