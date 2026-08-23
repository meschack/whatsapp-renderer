/** Decode UTF-8 incrementally so multibyte characters can span file chunks safely. */
export async function* decodeUtf8Chunks(
  chunks: AsyncIterable<Uint8Array>
): AsyncGenerator<string> {
  const decoder = new TextDecoder('utf-8')
  for await (const chunk of chunks) {
    const text = decoder.decode(chunk, { stream: true })
    if (text) yield text
  }

  const finalText = decoder.decode()
  if (finalText) yield finalText
}
