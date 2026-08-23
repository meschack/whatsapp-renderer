import { getStoredLinkPreview, saveStoredLinkPreview } from '../store/link-preview-database'
import { createLinkPreviewLoader } from './link-preview-cache'

const loader = createLinkPreviewLoader({
  repository: {
    get: getStoredLinkPreview,
    save: saveStoredLinkPreview
  }
})

export const getCachedLinkPreview = loader.peek
export const getPersistedLinkPreview = loader.read
export const loadLinkPreview = loader.load

export type { LinkPreviewData } from './link-preview-cache'
