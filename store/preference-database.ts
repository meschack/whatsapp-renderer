import { getArchiveDatabase } from './archive-database'

const HAPTIC_FEEDBACK_KEY = 'haptic-feedback-enabled'

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
