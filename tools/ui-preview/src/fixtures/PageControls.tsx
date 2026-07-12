// Side panel of mock controls. Drives:
//   - Auth state (writes / clears notionTokenStorage via the real popup hook)
//   - Last-used DB id (lastUsedDbStorage) — useful for testing the useEffect
//     sync in ClipperMain
//   - Page URL + selection fixtures (preview-only storage)
//
// The token placeholder is intentionally ASCII-only; useStorageItem accepts
// the popup's prefix validation and doesn't care about the value being
// a real Notion integration secret.

import { useEffect, useState } from "react";
import { useStorageItem } from "~/storage/react";
import {
  lastUsedDbStorage,
  notionTokenStorage,
  onboardingCompletedStorage,
} from "~/storage/items";
import {
  pageUrlFixtureStorage,
  selectionFixtureStorage,
} from "./fixture-storage";
import { pageFixtures } from "./page-fixtures";

const FAKE_TOKEN = "secret_PREVIEW_FAKE_TOKEN_replace_with_real";

export function PageControls() {
  const { value: token, set: setToken, remove: clearToken } =
    useStorageItem(notionTokenStorage);
  const { set: setOnboardingCompleted } = useStorageItem(onboardingCompletedStorage);
  const { value: lastDb, set: setLastDb } = useStorageItem(lastUsedDbStorage);
  const { value: pageUrl, set: setPageUrl } =
    useStorageItem(pageUrlFixtureStorage);
  const { value: selection, set: setSelection } =
    useStorageItem(selectionFixtureStorage);

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Quick keyboard shortcut: Cmd/Ctrl+R resets all fixture state *and*
  // suppresses the browser's native reload so the in-memory shim survives.
  // Raw reload would wipe state before our setToken() call lands.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "R") {
        e.preventDefault();
        void setToken(FAKE_TOKEN);
        void setOnboardingCompleted(true);
        const fx = pageFixtures[0];
        if (fx) {
          void setPageUrl(fx.url);
          void setSelection(fx.selection);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setToken, setPageUrl, setSelection]);

  function applyFixture(id: string) {
    const fx = pageFixtures.find((f) => f.id === id);
    if (!fx) return;
    void setPageUrl(fx.url);
    void setSelection(fx.selection);
  }

  const currentFixtureId =
    pageFixtures.find((f) => f.url === pageUrl)?.id ?? "";

  return (
    <div className="preview__controls">
      <div className="preview__ctl">
        <span className="preview__ctl-label">Auth state</span>
        <div className="preview__row">
          <button
            type="button"
            className="preview__btn"
            onClick={() => {
              void setToken(FAKE_TOKEN);
              void setOnboardingCompleted(true);
            }}
          >
            Sign in (fake)
          </button>
          <button
            type="button"
            className="preview__btn preview__btn--ghost"
            onClick={() => {
              void clearToken();
              void setOnboardingCompleted(false);
            }}
            disabled={!token}
          >
            Sign out
          </button>
        </div>
        <span className="preview__status">
          {token ? "Connected \u2713" : "No token \u2192 onboarding"}
        </span>
      </div>

      <div className="preview__ctl">
        <span className="preview__ctl-label">Target DB id (lastUsedDb)</span>
        <input
          className="preview__input"
          type="text"
          value={lastDb ?? ""}
          placeholder="papers"
          onChange={(e) => void setLastDb(e.target.value || null)}
        />
      </div>

      <div className="preview__ctl">
        <span className="preview__ctl-label">Page fixtures</span>
        <select
          className="preview__select"
          value={currentFixtureId}
          onChange={(e) => applyFixture(e.target.value)}
        >
          <option value="">Custom</option>
          {pageFixtures.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="preview__ctl">
        <span className="preview__ctl-label">Tab URL</span>
        <input
          className="preview__input"
          type="text"
          value={pageUrl ?? ""}
          onChange={(e) => void setPageUrl(e.target.value || null)}
        />
      </div>

      <div className="preview__ctl">
        <span className="preview__ctl-label">
          Selection ({selection?.length ?? 0} chars)
        </span>
        <textarea
          className="preview__textarea"
          rows={3}
          value={selection ?? ""}
          placeholder="No text selected"
          onChange={(e) => void setSelection(e.target.value || null)}
        />
      </div>

      <button
        type="button"
        className="preview__btn preview__btn--ghost"
        onClick={() => setShowAdvanced((s) => !s)}
      >
        {showAdvanced ? "Hide" : "Show"} notes
      </button>

      {showAdvanced && (
        <pre className="preview__notes">
{`// \u00b7 wxt/utils/storage is aliased to tools/ui-preview/src/shims/wxt-storage.ts
//   per Vite's resolve.alias. Refresh the page to reset in-memory state.
// \u00b7 notionTokenStorage / lastUsedDbStorage writes reach the popup's own useStorageItem;
//   PopupSettings vs ClipperMain routing is genuine.
// \u00b7 pageUrlFixtureStorage / selectionFixtureStorage are PREVIEW-ONLY. They will
//   mirror the extension's active-tab metadata flow.
// \u00b7 \u2318R / Ctrl-R: re-seed the default fixture (arXiv abstract).`}
        </pre>
      )}
    </div>
  );
}
