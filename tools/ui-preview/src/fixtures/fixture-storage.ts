// Preview-only storage items. These mimic what `content.ts` would expose to
// the popup in a future milestone — the running tab's URL + the user's
// selection. They live in the in-memory wxt/storage shim so the preview
// can be reset by reloading the page.
//
// In the WXT pop build, the popup will read these via a runtime message
// bridge to the active tab's content script; no chrome.storage path.

import { storage } from "../shims/wxt-storage";

export const pageUrlFixtureStorage = storage.defineItem<string | null>(
  "preview:pageUrl",
  { fallback: "https://arxiv.org/abs/2401.01234" },
);

export const selectionFixtureStorage = storage.defineItem<string | null>(
  "preview:selection",
  { fallback: null },
);
