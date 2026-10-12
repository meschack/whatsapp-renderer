import { describe, expect, it } from 'vitest'
import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import {
  constantTimeEqual,
  createPasscodeVerifier,
  isPasscodeVerifier,
  isValidPasscode,
  PASSCODE_ROUNDS,
  verifyPasscode
} from '../utils/passcode'

describe('Kinsay passcode verifier', () => {
  it('matches PBKDF2-HMAC-SHA256 at 600,000 rounds and stores no plaintext', async () => {
    const pin = '739182'
    const salt = Uint8Array.from({ length: 16 }, (_, i) => i)
    const record = await createPasscodeVerifier(pin, salt)
    const reference = pbkdf2(sha256, pin, salt, { c: PASSCODE_ROUNDS, dkLen: 32 })
    expect(record.digest).toBe(Buffer.from(reference).toString('hex'))
    expect(JSON.stringify(record)).not.toContain(pin)
    expect(await verifyPasscode(pin, record)).toBe(true)
    expect(await verifyPasscode('739183', record)).toBe(false)
  }, 30_000)
  it('yields to timers while hashing', async () => {
    let yielded = false
    const timer = setTimeout(() => {
      yielded = true
    }, 0)
    await createPasscodeVerifier('846203', new Uint8Array(16))
    clearTimeout(timer)
    expect(yielded).toBe(true)
  }, 15_000)
  it('rejects weak format and unsafe persisted work factors', () => {
    expect(isValidPasscode('12345')).toBe(false)
    expect(isValidPasscode('123456')).toBe(true)
    expect(isValidPasscode('1234567890123')).toBe(false)
    expect(isValidPasscode('123 456')).toBe(false)
    const record = {
      version: 1,
      salt: 'a'.repeat(32),
      digest: 'b'.repeat(64),
      rounds: PASSCODE_ROUNDS
    }
    expect(isPasscodeVerifier(record)).toBe(true)
    expect(isPasscodeVerifier({ ...record, rounds: 100 })).toBe(false)
    expect(isPasscodeVerifier({ ...record, rounds: 9e9 })).toBe(false)
  })
  it('compares every byte including mismatched lengths', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true)
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false)
    expect(constantTimeEqual(new Uint8Array([1]), new Uint8Array([1, 0]))).toBe(false)
  })
})
