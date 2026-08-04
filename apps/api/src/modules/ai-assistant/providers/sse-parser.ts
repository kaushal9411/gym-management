/**
 * Minimal SSE line reader shared by every streaming provider adapter — none
 * of them need more than "give me each `data: ...` payload as it arrives."
 * Buffers partial chunks across reads (a `data:` line can arrive split
 * across two TCP packets) and splits on the SSE spec's blank-line record
 * separator (`\n\n`).
 */
export async function* readSseDataLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const records = buffer.split('\n\n');
      buffer = records.pop() ?? '';

      for (const record of records) {
        for (const line of record.split('\n')) {
          const trimmed = line.trimStart();
          if (trimmed.startsWith('data:')) yield trimmed.slice(5).trim();
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
