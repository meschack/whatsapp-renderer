import { describe, expect, it, vi } from 'vitest'
import {
  createAppLockController,
  DEFAULT_APP_LOCK,
  getFailedAttempt,
  type AppLockRecord
} from '../utils/app-lock-policy'
const verifier = {
  version: 1 as const,
  rounds: 600_000,
  salt: 'a'.repeat(32),
  digest: 'b'.repeat(64)
}
function fixture(initial: AppLockRecord = { ...DEFAULT_APP_LOCK, verifier }) {
  let persisted = structuredClone(initial)
  let now = 1_000
  const deps = {
    load: vi.fn(async () => structuredClone(persisted)),
    save: vi.fn(async (record: AppLockRecord) => {
      persisted = structuredClone(record)
    }),
    create: vi.fn(async () => verifier),
    verify: vi.fn(async (pin: string) => pin === '739182'),
    biometric: vi.fn(async () => true),
    now: () => now
  }
  const controller = createAppLockController(deps, () => {})
  return {
    controller,
    deps,
    getPersisted: () => persisted,
    setNow: (value: number) => {
      now = value
    }
  }
}
describe('app lock controller', () => {
  it('never grants access before load, or with unreadable/corrupt secure state', async () => {
    const { controller, deps } = fixture()
    expect(controller.getState().status).toBe('loading')
    deps.load.mockRejectedValueOnce(new Error('Keychain unavailable'))
    await controller.initialize()
    expect(controller.getState().status).toBe('error')
    expect(await controller.unlock('739182')).toBe(false)
    deps.load.mockResolvedValueOnce({ ...DEFAULT_APP_LOCK, verifier: { ...verifier, rounds: 1 } })
    await controller.initialize()
    expect(controller.getState().status).toBe('error')
  })
  it('requires matching valid setup and existing passcode for change/disable', async () => {
    const { controller, deps } = fixture({ ...DEFAULT_APP_LOCK })
    await controller.initialize()
    expect(await controller.setup('739182', '739183')).toBe(false)
    expect(await controller.setup('739182', '739182')).toBe(true)
    expect(controller.getState().record.biometrics).toBe(false)
    expect(await controller.change('wrong', '839182', '839182')).toBe(false)
    expect(await controller.disable('wrong')).toBe(false)
    expect(await controller.change('739182', '839182', '839182')).toBe(true)
    expect(deps.create).toHaveBeenCalledTimes(2)
    expect(await controller.disable('739182')).toBe(true)
    expect(controller.getState().record.verifier).toBeNull()
  })
  it('persists attempts before verification and survives a process restart', async () => {
    const first = fixture()
    await first.controller.initialize()
    for (let attempt = 0; attempt < 5; attempt++)
      expect(await first.controller.unlock('000000')).toBe(false)
    expect(first.getPersisted()).toMatchObject({ failedAttempts: 5, cooldownUntil: 31_000 })
    const restarted = fixture(first.getPersisted())
    await restarted.controller.initialize()
    expect(await restarted.controller.unlock('739182')).toBe(false)
    expect(restarted.deps.verify).not.toHaveBeenCalled()
    restarted.setNow(31_001)
    expect(await restarted.controller.unlock('739182')).toBe(true)
    expect(restarted.getPersisted().failedAttempts).toBe(0)
  })
  it('blocks concurrent verification and invalidates a pending unlock on background', async () => {
    const { controller, deps } = fixture()
    await controller.initialize()
    let finish!: (result: boolean) => void
    deps.verify.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const pending = controller.unlock('739182')
    await Promise.resolve()
    await Promise.resolve()
    expect(await controller.unlock('739182')).toBe(false)
    controller.setForeground(false)
    finish(true)
    expect(await pending).toBe(false)
    controller.setForeground(true)
    expect(controller.getState().status).toBe('locked')
    expect(deps.verify).toHaveBeenCalledTimes(1)
  })
  it('fails closed if persisting an attempt or successful result fails', async () => {
    const { controller, deps } = fixture()
    await controller.initialize()
    deps.save.mockRejectedValueOnce(new Error('Write failed'))
    expect(await controller.unlock('739182')).toBe(false)
    expect(controller.getState().status).toBe('error')
    expect(deps.verify).not.toHaveBeenCalled()
    await controller.initialize()
    deps.save
      .mockImplementationOnce(async () => {})
      .mockRejectedValueOnce(new Error('Reset write failed'))
    expect(await controller.unlock('739182')).toBe(false)
    expect(controller.getState().status).toBe('error')
  })
  it('keeps biometrics opt-in and respects cooldown and background cancellation', async () => {
    const { controller, deps } = fixture()
    await controller.initialize()
    expect(await controller.unlockBiometric()).toBe(false)
    expect(deps.biometric).not.toHaveBeenCalled()
    expect(await controller.unlock('739182')).toBe(true)
    expect(await controller.configure('739182', { biometrics: true, hideAppPreview: true })).toBe(
      true
    )
    controller.lock()
    expect(await controller.unlockBiometric()).toBe(true)
  })
  it('does not open after successful biometrics complete in the background', async () => {
    const { controller, deps, getPersisted } = fixture({
      ...DEFAULT_APP_LOCK,
      verifier,
      biometrics: true
    })
    await controller.initialize()
    let finish!: (success: boolean) => void
    deps.biometric.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const pending = controller.unlockBiometric()
    await Promise.resolve()
    await Promise.resolve()
    controller.setForeground(false)
    finish(true)
    expect(await pending).toBe(false)
    expect(controller.getState().status).toBe('locked')
    expect(getPersisted().failedAttempts).toBe(1)
  })
  it('never changes options without the existing Kinsay passcode', async () => {
    const { controller } = fixture()
    await controller.initialize()
    await controller.unlock('739182')
    expect(await controller.configure('000000', { biometrics: true, hideAppPreview: true })).toBe(
      false
    )
    expect(controller.getState().record.biometrics).toBe(false)
  })
  it('locks initial setup even if the app resumes before credential storage finishes', async () => {
    const { controller, deps } = fixture({ ...DEFAULT_APP_LOCK })
    await controller.initialize()
    let finish!: () => void
    deps.save.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const pending = controller.setup('739182', '739182')
    await Promise.resolve()
    await Promise.resolve()
    controller.setForeground(false)
    controller.setForeground(true)
    finish()
    expect(await pending).toBe(false)
    expect(controller.getState().status).toBe('locked')
  })
  it('locks a setup that finishes storing credentials after the app backgrounds', async () => {
    const { controller, deps } = fixture({ ...DEFAULT_APP_LOCK })
    await controller.initialize()
    let finish!: () => void
    deps.save.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve
        })
    )
    const pending = controller.setup('739182', '739182')
    await Promise.resolve()
    await Promise.resolve()
    controller.setForeground(false)
    finish()
    await pending
    expect(controller.getState().status).toBe('locked')
    expect(controller.getState().record.verifier).not.toBeNull()
  })
  it('caps exponential cooldowns', () => {
    expect(
      getFailedAttempt({ ...DEFAULT_APP_LOCK, failedAttempts: 100 }, 1_000).cooldownUntil
    ).toBe(301_000)
  })
})
