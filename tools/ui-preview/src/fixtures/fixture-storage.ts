// Preview-only storage items. These mimic active-tab data in the in-memory
// WXT storage shim so the preview
// can be reset by reloading the page.
//
// The shipped popup reads page metadata through activeTab injection instead.

import { storage } from "../shims/wxt-storage";

export const pageUrlFixtureStorage = storage.defineItem<string | null>(
  "preview:pageUrl",
  { fallback: "https://arxiv.org/abs/2401.01234" },
);

export const selectionFixtureStorage = storage.defineItem<string | null>(
  "preview:selection",
  { fallback: null },
);
