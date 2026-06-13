export interface KeyedLock {
  run<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

// Serializes async work per key in-process: same key runs strictly one-at-a-time,
// different keys run concurrently. In-memory only — single-process for now.
export function createKeyedLock(): KeyedLock {
  const tails = new Map<string, Promise<unknown>>();
  return {
    run<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const prev = tails.get(key) ?? Promise.resolve();
      const result = prev.then(fn, fn);
      const tail = result.then(
        () => {},
        () => {},
      );
      tails.set(key, tail);
      void tail.then(() => {
        if (tails.get(key) === tail) {
          tails.delete(key);
        }
      });
      return result;
    },
  };
}
