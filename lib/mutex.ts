/**
 * Tiny async mutex — serializes calls to `mutate()` so concurrent requests
 * can't clobber each other's writes. Uses a simple queue on the global.
 * No external deps, ~30 lines.
 */

type Task = { resolve: (v: unknown) => void; reject: (e: Error) => void; fn: () => Promise<unknown> };

const g = globalThis as unknown as { __pokemedMutex?: { queue: Task[]; running: boolean } };

function getMutex() {
  if (!g.__pokemedMutex) g.__pokemedMutex = { queue: [], running: false };
  return g.__pokemedMutex;
}

/**
 * Run `fn` exclusively. Returns a promise that resolves with fn's result.
 * All callers wait their turn; order is FIFO.
 */
export async function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const mutex = getMutex();
  return new Promise<T>((resolve, reject) => {
    mutex.queue.push({ resolve: resolve as (v: unknown) => void, reject, fn: fn as () => Promise<unknown> });
    drain();
  });
}

async function drain() {
  const mutex = getMutex();
  if (mutex.running || mutex.queue.length === 0) return;
  mutex.running = true;
  while (mutex.queue.length > 0) {
    const task = mutex.queue.shift()!;
    try {
      const result = await task.fn();
      task.resolve(result);
    } catch (e) {
      task.reject(e instanceof Error ? e : new Error(String(e)));
    }
  }
  mutex.running = false;
}