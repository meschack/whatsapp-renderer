import { throwIfImportAborted } from './import-cancellation'
import { File } from 'expo-file-system'

import { decodeUtf8Chunks } from '@/utils/utf8-stream'

async function* readFileChunks(
  stream: ReadableStream<Uint8Array<ArrayBuffer>>,
  signal?: AbortSignal
): AsyncGenerator<Uint8Array<ArrayBuffer>> {
  throwIfImportAborted(signal)
  const reader = stream.getReader()
  const abort = () => {
    void reader.cancel().catch(() => {})
  }
  signal?.addEventListener('abort', abort, { once: true })

  try {
    while (true) {
      throwIfImportAborted(signal)
      const { value, done } = await reader.read()
      throwIfImportAborted(signal)
      if (done) break
      yield value
    }
  } finally {
    signal?.removeEventListener('abort', abort)
    reader.releaseLock()
  }
}

/** Return a factory because date inference requires a second bounded pass. */
export function openFileTranscript(
  transcriptUri: string,
  signal?: AbortSignal
): () => AsyncIterable<string> {
  const file = new File(transcriptUri)
  return () => decodeUtf8Chunks(readFileChunks(file.stream(), signal))
}
