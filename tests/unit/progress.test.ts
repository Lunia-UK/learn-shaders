import { describe, expect, it, vi } from 'vitest';
import { createProgressStore } from '../../src/lessons/progress';

/** A localStorage stand-in backed by a Map. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  };
}

/** A storage that throws on every access, like Safari with storage blocked. */
const blockedStorage = new Proxy({} as Storage, {
  get() {
    return () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
  },
});

describe('progress store', () => {
  it('starts with nothing solved', () => {
    expect(createProgressStore(memoryStorage()).isSolved('01-pixels/01-one-color')).toBe(false);
  });

  it('remembers a solved lesson across stores using the same storage', () => {
    const storage = memoryStorage();
    createProgressStore(storage).markSolved('01-pixels/01-one-color');
    const later = createProgressStore(storage);
    expect(later.isSolved('01-pixels/01-one-color')).toBe(true);
    expect(later.isSolved('01-pixels/02-position')).toBe(false);
  });

  it('notifies subscribers once per new lesson solved', () => {
    const store = createProgressStore(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.markSolved('a');
    store.markSolved('a');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.markSolved('b');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores saved data it cannot read', () => {
    const store = createProgressStore(memoryStorage({ 'progress:v1': '{not json' }));
    expect(store.isSolved('a')).toBe(false);
  });

  it('keeps working for this visit when storage throws', () => {
    const store = createProgressStore(blockedStorage);
    expect(store.isSolved('a')).toBe(false);
    expect(() => store.markSolved('a')).not.toThrow();
    expect(store.isSolved('a')).toBe(true);
  });

  it('keeps working without any storage', () => {
    const store = createProgressStore(null);
    store.markSolved('a');
    expect(store.isSolved('a')).toBe(true);
  });
});
