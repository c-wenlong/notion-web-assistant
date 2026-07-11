// In-memory shim of `wxt/storage` for the UI preview. Vite's `resolve.alias`
// rewrites the popup's `import { storage } from "wxt/storage"` to this file
// at *runtime*. tsc doesn't honor the Vite alias, so the import type ships
// from the real `wxt/storage` package. To make items fabricated here
// compatible with the popup's `useStorageItem<T>()` at compile time without
// hand-rolling an interface that mirrors every future WxtStorageItem field,
// we cast the runtime impl to `ReturnType<typeof wxtStorage.defineItem<T>>`
// — the exact shape tsc sees.
//
// Caveat: this shim implements ONLY the methods the popup actually calls
// (getValue / setValue / removeValue / watch / fallback). Future popup code
// that calls key / defaultValue / getMeta / setMeta / migrate would throw
// at runtime. Add the methods here when such callers land.

import type { storage as wxtStorage } from "wxt/storage";

/** Per-key in-memory value store. */
const store = new Map<string, unknown>();
/** Per-key watcher fan-out list. */
const watchers = new Map<string, Set<(v: unknown | null) => void>>();

function listenersFor(key: string): Set<(v: unknown | null) => void> {
  let ls = watchers.get(key);
  if (!ls) {
    ls = new Set();
    watchers.set(key, ls);
  }
  return ls;
}

function notify(key: string, value: unknown): void {
  // Look up without auto-creating; only the watch path is allowed to insert
  // a new entry, so setValue/removeValue never accumulate empty Sets.
  const ls = watchers.get(key);
  if (!ls) return;
  for (const cb of ls) cb(value);
}

export const storage = {
  defineItem<T>(
    key: string,
    opts?: { fallback?: T },
  ): ReturnType<typeof wxtStorage.defineItem<T>> {
    return {
      fallback: opts?.fallback,
      async getValue(): Promise<T> {
        return store.has(key)
          ? (store.get(key) as T)
          : ((opts?.fallback ?? undefined) as T);
      },
      async setValue(value: T): Promise<void> {
        store.set(key, value);
        notify(key, value);
      },
      async removeValue(_opts?: { shouldRemoveMetadata?: boolean }): Promise<void> {
        store.delete(key);
        notify(key, null);
      },
      watch(callback: (newValue: T | null) => void): () => void {
        const wrapped = (raw: unknown | null) => callback(raw as T | null);
        const ls = listenersFor(key);
        ls.add(wrapped);
        return () => {
          ls.delete(wrapped);
        };
      },
    } as unknown as ReturnType<typeof wxtStorage.defineItem<T>>;
  },
};

/** Test/debug helpers — not part of the real `wxt/storage` API. */
export const __debug = {
  peek(key: string): unknown {
    return store.get(key);
  },
  reset(): void {
    store.clear();
    for (const ls of watchers.values()) ls.clear();
  },
};
