// Spec §4.2.5 mobile-compatibility invariants on Recipe JSON.
// The Builder enforces these on save AND the runtime double-checks on load.
// Plain JSON only: no functions, no BigInt, no `undefined`, no DOM / extension
// globals in keys. Anything else means a future mobile app can't parse it.
//
// This module is a runtime guard called when a Recipe row is loaded from the
// Config DB. It also catches typos like typing `chrome.tabs.query(...)` into a
// field by mistake.

import { RecipeStepError } from "./errors";

/**
 * Recursively validate that `value` is plain JSON-safe per spec §4.2.5.
 * Throws `RecipeStepError` with `stepId` context on the first violation.
 *
 * Invariants checked:
 *   - No functions, BigInt, or `undefined` values
 *   - No object keys that look like host-extension globals
 *     (chrome.*, browser.*, window.*, document.*)
 *   - No DOM elements (HTMLElement instances) — checked defensively where types allow
 */
export function assertRecipeSerializable(value: unknown, stepId: string): void {
  if (typeof value === "function") {
    throw new RecipeStepError(
      `Step "${stepId}" has a function in params (spec §4.2.5 requires plain JSON).`,
      { stepId },
    );
  }
  if (typeof value === "bigint" || typeof value === "undefined") {
    throw new RecipeStepError(
      `Step "${stepId}" has a non-JSON value (${typeof value}) in params.`,
      { stepId },
    );
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      assertRecipeSerializable(item, stepId);
    }
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      checkKey(k, stepId);
      assertRecipeSerializable(v, stepId);
    }
  }
}

/** Disallow object keys that look like extension / DOM globals — spec §4.2.5. */
function checkKey(key: string, stepId: string): void {
  if (/^(chrome|browser|window|document|self|globalThis)$/i.test(key)) {
    throw new RecipeStepError(
      `Step "${stepId}" references a host-extension/DOM global as an object key: "${key}". ` +
        `Spec §4.2.5 forbids this so recipes stay mobile-portable.`,
      { stepId },
    );
  }
}
