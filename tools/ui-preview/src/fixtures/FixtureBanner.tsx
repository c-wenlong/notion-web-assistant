// Compact banner above the popup showing the active "tab" URL + selection
// preview. Reads only the preview-only fixture storage items so it has zero
// coupling to the popup's own state.

import { useStorageItem } from "~/storage/react";
import {
  pageUrlFixtureStorage,
  selectionFixtureStorage,
} from "./fixture-storage";

const ELLIPSIS = "\u2026";

export function FixtureBanner() {
  const { value: pageUrl } = useStorageItem(pageUrlFixtureStorage);
  const { value: selection } = useStorageItem(selectionFixtureStorage);

  return (
    <div className="preview__banner" role="status" aria-live="polite">
      <span className="preview__banner-label">Active tab</span>
      <code className="preview__banner-url">{pageUrl ?? "\u2014"}</code>
      <span className="preview__banner-sep">\u00b7</span>
      <span className="preview__banner-label">Selection</span>
      <span className="preview__banner-sel">
        {selection
          ? `${selection.slice(0, 64)}${selection.length > 64 ? "\u2026" : ""}`
          : "(none)"}
      </span>
    </div>
  );
}
