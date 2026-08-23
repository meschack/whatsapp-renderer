import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'

import {
  createArchiveBootstrap,
  type ArchiveBindValue,
  type ArchiveDatabase
} from './archive-bootstrap'

const DATABASE_NAME = 'whatsapp-renderer.db'

class ExpoArchiveDatabase implements ArchiveDatabase {
  constructor(readonly nativeDatabase: SQLiteDatabase) {}

  async exec(source: string): Promise<void> {
    await this.nativeDatabase.execAsync(source)
  }

  async run(source: string, params: ArchiveBindValue[] = []): Promise<void> {
    await this.nativeDatabase.runAsync(source, params)
  }

  async first<T>(source: string, params: ArchiveBindValue[] = []): Promise<T | null> {
    return this.nativeDatabase.getFirstAsync<T>(source, params)
  }

  async all<T>(source: string, params: ArchiveBindValue[] = []): Promise<T[]> {
    return this.nativeDatabase.getAllAsync<T>(source, params)
  }

  async transaction(task: (database: ArchiveDatabase) => Promise<void>): Promise<void> {
    await this.nativeDatabase.withExclusiveTransactionAsync(async transaction => {
      await task(new ExpoArchiveDatabase(transaction))
    })
  }

  async close(): Promise<void> {
    await this.nativeDatabase.closeAsync()
  }
}

let activeDatabase: SQLiteDatabase | null = null

export const bootstrapArchive = createArchiveBootstrap(
  async () => new ExpoArchiveDatabase(await openDatabaseAsync(DATABASE_NAME)),
  database => {
    activeDatabase = (database as ExpoArchiveDatabase).nativeDatabase
  }
)

export function getArchiveDatabase(): SQLiteDatabase {
  if (!activeDatabase) {
    throw new Error('The chat archive database was accessed before bootstrap completed')
  }
  return activeDatabase
}
