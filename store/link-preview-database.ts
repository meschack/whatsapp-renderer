import { getArchiveDatabase } from './archive-database'
import type { LinkPreviewData, StoredLinkPreview } from '../utils/link-preview-cache'

interface LinkPreviewRow {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  status: 'success' | 'failure'
  expiresAt: number
}

const MAX_PERSISTED_PREVIEWS = 500

export async function getStoredLinkPreview(
  url: string,
  now = Date.now()
): Promise<StoredLinkPreview | null> {
  const db = getArchiveDatabase()
  const row = await db.getFirstAsync<LinkPreviewRow>(
    `SELECT title, description, image, siteName, status, expiresAt
     FROM link_previews WHERE url = ?`,
    url
  )
  if (!row) return null
  if (row.expiresAt <= now) {
    await db.runAsync('DELETE FROM link_previews WHERE url = ?', url)
    return null
  }

  const data: LinkPreviewData | null =
    row.status === 'success'
      ? {
          title: row.title,
          description: row.description,
          image: row.image,
          siteName: row.siteName
        }
      : null
  return { data, expiresAt: row.expiresAt }
}

export async function saveStoredLinkPreview(
  url: string,
  data: LinkPreviewData | null,
  expiresAt: number,
  now = Date.now()
): Promise<void> {
  const db = getArchiveDatabase()
  await db.runAsync(
    `INSERT INTO link_previews
       (url, title, description, image, siteName, status, expiresAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       image = excluded.image,
       siteName = excluded.siteName,
       status = excluded.status,
       expiresAt = excluded.expiresAt,
       updatedAt = excluded.updatedAt`,
    url,
    data?.title ?? null,
    data?.description ?? null,
    data?.image ?? null,
    data?.siteName ?? null,
    data ? 'success' : 'failure',
    expiresAt,
    now
  )
  await db.runAsync('DELETE FROM link_previews WHERE expiresAt <= ?', now)
  await db.runAsync(
    `DELETE FROM link_previews
     WHERE url IN (
       SELECT url FROM link_previews ORDER BY updatedAt DESC LIMIT -1 OFFSET ?
     )`,
    MAX_PERSISTED_PREVIEWS
  )
}
