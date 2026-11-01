// One deadline covers Auth, body consumption, pool queue and query execution.
export function manualDeadline(signal: AbortSignal) {
  const failure = new Error("Manual request deadline exceeded");
  let reject!: (error: Error) => void;
  const expired = new Promise<never>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  // The deadline may expire between phases, with no race currently observing it.
  void expired.catch(() => {});
  const abort = () => reject(failure);
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  return {
    signal,
    async wait<T>(operation: PromiseLike<T>): Promise<T> {
      if (signal.aborted) throw failure;
      return await Promise.race([operation, expired]);
    },
    dispose() {
      signal.removeEventListener("abort", abort);
    },
  };
}
export type ManualDeadline = ReturnType<typeof manualDeadline>;
export async function readManualBody(
  request: Request,
  deadline: ManualDeadline,
  maxBytes = 20000,
) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  let complete = false;
  try {
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await deadline.wait(reader.read());
      if (done) {
        complete = true;
        break;
      }
      size += value.length;
      if (size > maxBytes) throw new Error("Body too large");
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally {
    // Do not await an untrusted stream's cancellation promise beyond the deadline.
    if (!complete) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function manualQuery<T>(
  query: Promise<T> & { execute(): unknown; cancel(): void },
  deadline: ManualDeadline,
): Promise<T> {
  if (deadline.signal.aborted) {
    throw new Error("Manual request deadline exceeded");
  }
  // postgresjs 3.4.5 cancel removes a queued query or sends an active cancellation.
  // Verified in its pinned Query.cancel and index cancel(query) implementations.
  const cancel = () => query.cancel();
  deadline.signal.addEventListener("abort", cancel, { once: true });
  try {
    query.execute();
    return await deadline.wait(query);
  } finally {
    deadline.signal.removeEventListener("abort", cancel);
  }
}
