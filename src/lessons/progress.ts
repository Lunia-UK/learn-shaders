// Which lessons the learner solved, kept in localStorage (no accounts).
// Storage can be missing or throw (private browsing, blocked cookies, server rendering):
// every access is guarded, and the course still works, it just forgets.

const KEY = 'progress:v1';

interface SavedProgress {
  solved: string[];
}

export interface ProgressStore {
  isSolved(lessonId: string): boolean;
  markSolved(lessonId: string): void;
  /** Calls `listener` when progress changes, here or in another tab. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
}

/** Storage access as the browser gives it, or null when there is none. */
function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createProgressStore(storage: Storage | null): ProgressStore {
  const listeners = new Set<() => void>();
  // Parsed once and kept until it changes, so reading it during rendering is cheap.
  let cache: Set<string> | null = null;

  function read(): Set<string> {
    if (cache) return cache;
    try {
      const saved = JSON.parse(storage?.getItem(KEY) ?? 'null') as SavedProgress | null;
      cache = new Set(Array.isArray(saved?.solved) ? saved.solved : []);
    } catch {
      cache = new Set();
    }
    return cache;
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== KEY) return;
    cache = null;
    notify();
  }

  return {
    isSolved: (lessonId) => read().has(lessonId),

    markSolved(lessonId) {
      const solved = read();
      if (solved.has(lessonId)) return;
      cache = new Set(solved).add(lessonId);
      try {
        storage?.setItem(KEY, JSON.stringify({ solved: [...cache] } satisfies SavedProgress));
      } catch {
        // Full or blocked storage: keep the progress for this visit only.
      }
      notify();
    },

    subscribe(listener) {
      if (listeners.size === 0 && typeof window !== 'undefined') {
        window.addEventListener('storage', onStorage);
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && typeof window !== 'undefined') {
          window.removeEventListener('storage', onStorage);
        }
      };
    },
  };
}

/** The learner's progress in this browser. */
export const progress = createProgressStore(browserStorage());
