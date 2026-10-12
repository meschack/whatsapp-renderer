import { getArchiveDatabase } from './archive-database'
import { normalizeAppAppearance, type AppAppearanceSettings } from '@/utils/app-theme'

function settingsDatabase() {
  const database = getArchiveDatabase()
  database.execSync(
    'CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
  )
  return database
}
export function getAppAppearanceSettings(): AppAppearanceSettings {
  const row = settingsDatabase().getFirstSync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    'appearance'
  )
  try {
    return normalizeAppAppearance(row ? JSON.parse(row.value) : null)
  } catch {
    return normalizeAppAppearance(null)
  }
}
export function saveAppAppearanceSettings(settings: AppAppearanceSettings): void {
  settingsDatabase().runSync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    'appearance',
    JSON.stringify(normalizeAppAppearance(settings))
  )
}
