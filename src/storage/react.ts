// Custom reactive bindings around `wxt/utils/storage` items for React components.
//
// WXT's storage module does not export a React hook, so
// we derive the type from `storage.defineItem<T>` itself. This way the hook
// stays in lock-step with whatever signature WXT ships (e.g. `removeValue`
// taking an options object rather than a string).

import { useCallback, useEffect, useState } from "react";
import type { storage as storageNs } from "wxt/utils/storage";

/**
 * Whatever `storage.defineItem<T>(...)` returns, narrowed by T.
 * Mirrors `WxtStorageItem` without importing an internal name that might
 * change across WXT versions.
 */
type AnyStorageItem<T> = ReturnType<typeof storageNs.defineItem<T>>;

export interface UseStorageItemReturn<T> {
  /** Current value. `undefined` = not yet loaded; `null` is normalized out. */
  value: T | undefined;
  /**
   * Write-and-publish. Functional form supported like React's `setState`.
   * Accepts `T | null | undefined`: `null`/`undefined` clear the storage key
   * (WxtStorageItem treats these as remove). This matches real WXT behavior
   * and lets preview fixtures use `e.target.value || null` for "blank".
   */
  set: (
    next:
      | T
      | null
      | undefined
      | ((prev: T | undefined) => T | null | undefined),
  ) => Promise<void>;
  /** Remove from storage; UI returns to the item's fallback. */
  remove: () => Promise<void>;
}

/**
 * Subscribe a React component to a `wxt/utils/storage` item.
 * - Initial render uses `item.fallback` so the popup paints instantly.
 * - On mount, an async `getValue()` overwrites with the persisted value.
 * - On any `item.watch()` event (cross-context changes), the component re-renders.
 * - `set`/`remove` are memoized so they're safe in child `useEffect`/`memo` deps.
 */
export function useStorageItem<T>(
  item: AnyStorageItem<T>,
): UseStorageItemReturn<T> {
  const fallback = item.fallback;
  // WXT's `watch` callback hands us `T | null` after `removeValue` from another
  // context. Widening the internal state to `T | null | undefined` lets us
  // accept that null directly; we collapse it to `undefined` at the boundary
  // so callers never see `null`.
  const [value, setValue] = useState<T | null | undefined>(fallback);

  useEffect(() => {
    let cancelled = false;
    void item.getValue().then((v) => {
      if (!cancelled) setValue(v);
    });
    const unwatch = item.watch((newValue) => {
      if (!cancelled) setValue(newValue ?? fallback ?? null);
    });
    return () => {
      cancelled = true;
      unwatch();
    };
    // `item` is module-singleton in our codebase; identity stable.
  }, [item, fallback]);

  // Public-facing value strips the internal `null` to `undefined`.
  const viewValue: T | undefined = value ?? undefined;

  const set = useCallback(
    async (
      next:
        | T
        | null
        | undefined
        | ((prev: T | undefined) => T | null | undefined),
    ): Promise<void> => {
      const resolved: T | null | undefined =
        typeof next === "function"
          ? (next as (prev: T | undefined) => T | null | undefined)(viewValue)
          : next;
      // Per spec §3.2: caller-intended "blank" maps to *removal* (falls back
      // to defaultValue / null on the next read), not to storing null. Real
      // WXT storage behaves the same: setValue(null) would persist `null` as
      // a value rather than clearing the key.
      if (resolved === null || resolved === undefined) {
        await item.removeValue();
        setValue(resolved);
      } else {
        await item.setValue(resolved);
        setValue(resolved);
      }
    },
    [item, viewValue],
  );

  const remove = useCallback(async (): Promise<void> => {
    await item.removeValue();
    setValue(fallback);
  }, [item, fallback]);

  return { value: viewValue, set, remove };
}
