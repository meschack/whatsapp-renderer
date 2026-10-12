import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ database: null as TestDatabase | null }))
vi.mock('../store/archive-database', () => ({ getArchiveDatabase: () => state.database }))
import { getAppAppearanceSettings, saveAppAppearanceSettings } from '../store/app-settings'
import {
  getChatAppearance,
  resetChatAppearance,
  saveChatAppearance
} from '../store/chat-appearance-database'
import { DEFAULT_CHAT_APPEARANCE, resolveChatTextScale } from '../utils/chat-appearance'
class TestDatabase {
  constructor(private readonly database: DatabaseSync) {}
  execSync(sql: string) {
    this.database.exec(sql)
  }
  getFirstSync<T>(sql: string, ...params: (string | number | null)[]) {
    return (this.database.prepare(sql).get(...params) as T | undefined) ?? null
  }
  runSync(sql: string, ...params: (string | number | null)[]) {
    this.database.prepare(sql).run(...params)
  }
}
describe('persisted appearance', () => {
  let sqlite: DatabaseSync
  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec(
      'CREATE TABLE chat_appearance (chatId TEXT PRIMARY KEY, wallpaper TEXT, textScale REAL, customWallpaperUri TEXT, wallpaperDimming REAL, textScaleOverride REAL)'
    )
    state.database = new TestDatabase(sqlite)
  })
  afterEach(() => {
    state.database = null
    sqlite.close()
  })
  it('restores global defaults and recovers a malformed settings value', () => {
    expect(getAppAppearanceSettings()).toEqual({ mode: 'system', defaultTextScale: 1 })
    saveAppAppearanceSettings({ mode: 'light', defaultTextScale: 1.15 })
    expect(getAppAppearanceSettings()).toEqual({ mode: 'light', defaultTextScale: 1.15 })
    sqlite.prepare('UPDATE app_settings SET value = ?').run('{broken')
    expect(getAppAppearanceSettings()).toEqual({ mode: 'system', defaultTextScale: 1 })
  })
  it('a new chat and wallpaper-only saves follow app defaults across reloads', () => {
    expect(resolveChatTextScale(getChatAppearance('new'), 1.15)).toBe(1.15)
    saveChatAppearance('new', { ...getChatAppearance('new'), wallpaper: 'forest' })
    const reloaded = getChatAppearance('new')
    expect(reloaded.wallpaper).toBe('forest')
    expect(reloaded.textScaleOverride).toBeNull()
    expect(resolveChatTextScale(reloaded, 0.9)).toBe(0.9)
  })
  it('keeps explicit per-chat sizes, then follows defaults after reset', () => {
    saveChatAppearance('chat', { ...DEFAULT_CHAT_APPEARANCE, textScale: 1, textScaleOverride: 1 })
    expect(resolveChatTextScale(getChatAppearance('chat'), 1.15)).toBe(1)
    saveChatAppearance('chat', { ...getChatAppearance('chat'), textScaleOverride: null })
    expect(resolveChatTextScale(getChatAppearance('chat'), 1.15)).toBe(1.15)
    resetChatAppearance('chat')
    expect(getChatAppearance('chat').textScaleOverride).toBeNull()
  })
  it('retains old in-memory callers as explicit choices', () => {
    saveChatAppearance('legacy', { ...DEFAULT_CHAT_APPEARANCE, textScale: 0.9 })
    expect(getChatAppearance('legacy').textScaleOverride).toBe(0.9)
  })
})
