import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ database: null as TestDatabase | null }))

vi.mock('../store/archive-database', () => ({ getArchiveDatabase: () => state.database }))

import { getStoredLinkPreview, saveStoredLinkPreview } from '../store/link-preview-database'

class TestDatabase {
  constructor(private readonly database: DatabaseSync) {}

  async getFirstAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T | null> {
    return (this.database.prepare(source).get(...params) as T | undefined) ?? null
  }

  async runAsync(source: string, ...params: (string | number | null)[]): Promise<void> {
    this.database.prepare(source).run(...params)
  }
}

describe('persistent link preview cache', () => {
  let sqlite: DatabaseSync

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec(`
      CREATE TABLE link_previews (
        url TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        image TEXT,
        siteName TEXT,
        status TEXT NOT NULL,
        expiresAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `)
    state.database = new TestDatabase(sqlite)
  })

  afterEach(() => {
    state.database = null
    sqlite.close()
  })

  it('round-trips successes and failures until their expiry', async () => {
    const data = { title: 'Stored', description: 'Local', image: null, siteName: 'Example' }
    await saveStoredLinkPreview('https://example.com/success', data, 5_000, 1_000)
    await saveStoredLinkPreview('https://example.com/failure', null, 3_000, 1_000)

    await expect(getStoredLinkPreview('https://example.com/success', 2_000)).resolves.toEqual({
      data,
      expiresAt: 5_000
    })
    await expect(getStoredLinkPreview('https://example.com/failure', 2_000)).resolves.toEqual({
      data: null,
      expiresAt: 3_000
    })
    await expect(getStoredLinkPreview('https://example.com/failure', 3_000)).resolves.toBeNull()
    expect(
      sqlite
        .prepare('SELECT COUNT(*) AS count FROM link_previews WHERE url = ?')
        .get('https://example.com/failure')
    ).toEqual({ count: 0 })
  })
})
