import { describe, expect, it } from 'vitest';
import { createKeyedLock } from './keyed-lock.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('createKeyedLock', () => {
  it('serializes work on the same key', async () => {
    const lock = createKeyedLock();
    const log: string[] = [];
    let active = 0;
    let maxActive = 0;

    const task = (name: string) =>
      lock.run('k', async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        log.push(`start:${name}`);
        await Promise.resolve();
        await Promise.resolve();
        log.push(`end:${name}`);
        active -= 1;
      });

    await Promise.all([task('a'), task('b'), task('c')]);

    expect(maxActive).toBe(1);
    expect(log).toEqual([
      'start:a',
      'end:a',
      'start:b',
      'end:b',
      'start:c',
      'end:c',
    ]);
  });

  it('runs different keys concurrently', async () => {
    const lock = createKeyedLock();
    const blocker = deferred<void>();
    let bDone = false;

    const pa = lock.run('a', () => blocker.promise);
    const pb = lock.run('b', async () => {
      bDone = true;
    });

    await pb;
    expect(bDone).toBe(true);
    blocker.resolve();
    await pa;
  });

  it('continues the chain after a task throws', async () => {
    const lock = createKeyedLock();
    const ran: string[] = [];

    const failing = lock.run('k', async () => {
      throw new Error('boom');
    });
    const next = lock.run('k', async () => {
      ran.push('next');
    });

    await expect(failing).rejects.toThrow('boom');
    await next;
    expect(ran).toEqual(['next']);
  });

  it('returns the result of fn', async () => {
    const lock = createKeyedLock();
    await expect(lock.run('k', async () => 42)).resolves.toBe(42);
  });
});
