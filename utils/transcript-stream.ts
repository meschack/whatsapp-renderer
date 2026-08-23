import { File } from 'expo-file-system'

import { decodeUtf8Chunks } from '@/utils/utf8-stream'

async function* readFileChunks(
  stream: ReadableStream<Uint8Array<ArrayBuffer>>
): AsyncGenerator<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader()

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

/** Return a factory because date inference requires a second bounded pass. */
export function openFileTranscript(transcriptUri: string): () => AsyncIterable<string> {
  const file = new File(transcriptUri)
  return () => decodeUtf8Chunks(readFileChunks(file.stream()))
}
