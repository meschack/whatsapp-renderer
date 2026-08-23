import { getArchiveDatabase } from './archive-database'

const HAPTIC_FEEDBACK_KEY = 'haptic-feedback-enabled'
const AUDIO_PLAYBACK_RATE_KEY = 'audio-playback-rate'

export function isHapticFeedbackEnabled(): boolean {
  const row = getArchiveDatabase().getFirstSync<{ value: string }>(
    'SELECT value FROM app_preferences WHERE key = ?',
    HAPTIC_FEEDBACK_KEY
  )
  return row?.value === 'true'
}

export function setHapticFeedbackEnabled(enabled: boolean): void {
  getArchiveDatabase().runSync(
    `INSERT INTO app_preferences (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    HAPTIC_FEEDBACK_KEY,
    enabled ? 'true' : 'false'
  )
}

export function getPreferredAudioPlaybackRate(): number {
  const row = getArchiveDatabase().getFirstSync<{ value: string }>(
    'SELECT value FROM app_preferences WHERE key = ?',
    AUDIO_PLAYBACK_RATE_KEY
  )
  const rate = Number(row?.value)
  return rate === 1 || rate === 1.5 || rate === 2 ? rate : 1
}

export function setPreferredAudioPlaybackRate(rate: number): void {
  if (rate !== 1 && rate !== 1.5 && rate !== 2) return
  getArchiveDatabase().runSync(
    `INSERT INTO app_preferences (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    AUDIO_PLAYBACK_RATE_KEY,
    String(rate)
  )
}
