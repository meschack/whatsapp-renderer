import JSZip from 'jszip'

export const E2E_FIXTURE_CHAT_NAME = 'E2E Archive'
export const E2E_INITIAL_MESSAGE_COUNT = 1560
export const E2E_UPDATE_MESSAGE_COUNT = 1680

// Small green image, decoded by the production attachment/indexing path.
const IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGNkWNHyn4GBgYGJAQoAIGQCL+StGisAAAAASUVORK5CYII='
const ZIP_DATE = new Date('2026-08-13T00:00:00Z')

export interface E2EExportFixtures {
  initial: Uint8Array
  update: Uint8Array
  initialName: string
  updateName: string
  expected: {
    initialMessageCount: number
    updateMessageCount: number
    newMessageCount: number
    firstAnchor: string
    lastInitialAnchor: string
    lastUpdateAnchor: string
    searchNeedle: string
    imageFilename: string
    audioFilename: string
  }
}

export function e2eMessageAnchor(index: number): string {
  return `E2E message ${String(index).padStart(4, '0')}`
}

/** Deterministic, timezone-independent transcript; dates include unambiguous DMY evidence. */
export function createE2ETranscript(messageCount: number): string {
  if (!Number.isInteger(messageCount) || messageCount < 1)
    throw new Error('Expected a positive fixture message count.')
  return (
    Array.from({ length: messageCount }, (_, offset) => {
      const date = new Date(Date.UTC(2026, 7, 13 + Math.floor(offset / 60)))
      const day = String(date.getUTCDate()).padStart(2, '0')
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const minute = String(offset % 60).padStart(2, '0')
      const sender = offset % 2 ? 'Alice' : 'Me'
      const anchor = e2eMessageAnchor(offset + 1)
      const body =
        offset === 11
          ? `fixture-image.png (file attached)\n${anchor}`
          : offset === 23
            ? `fixture-audio.opus (file attached)\n${anchor}`
            : `${anchor}: deterministic archive history.`
      return `${day}/${month}/26, 08:${minute} - ${sender}: ${body}`
    }).join('\n') + '\n'
  )
}

async function createArchive(messageCount: number): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('_chat.txt', createE2ETranscript(messageCount), { date: ZIP_DATE })
  zip.file('fixture-image.png', IMAGE_BASE64, { base64: true, date: ZIP_DATE })
  // Deliberately omitted audio exercises missing-attachment handling without bogus playback.
  return zip.generateAsync({ type: 'uint8array', compression: 'STORE', platform: 'DOS' })
}

/** Pure fixture bytes; this utility never seeds storage or enables a test build itself. */
export async function createE2EExportFixtures(): Promise<E2EExportFixtures> {
  const [initial, update] = await Promise.all([
    createArchive(E2E_INITIAL_MESSAGE_COUNT),
    createArchive(E2E_UPDATE_MESSAGE_COUNT)
  ])
  return {
    initial,
    update,
    initialName: `WhatsApp Chat - ${E2E_FIXTURE_CHAT_NAME}.zip`,
    updateName: `WhatsApp Chat - ${E2E_FIXTURE_CHAT_NAME} update.zip`,
    expected: {
      initialMessageCount: E2E_INITIAL_MESSAGE_COUNT,
      updateMessageCount: E2E_UPDATE_MESSAGE_COUNT,
      newMessageCount: E2E_UPDATE_MESSAGE_COUNT - E2E_INITIAL_MESSAGE_COUNT,
      firstAnchor: e2eMessageAnchor(1),
      lastInitialAnchor: e2eMessageAnchor(E2E_INITIAL_MESSAGE_COUNT),
      lastUpdateAnchor: e2eMessageAnchor(E2E_UPDATE_MESSAGE_COUNT),
      searchNeedle: e2eMessageAnchor(720),
      imageFilename: 'fixture-image.png',
      audioFilename: 'fixture-audio.opus'
    }
  }
}
