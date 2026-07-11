// AuthCard — non-Notion connection card on the Options page.
// Mirrors the popup's AuthGate shape but with more breathing room (full tab
// not a 360px popup) + a post-save workspace hint + a danger-zone sign-out.
//
// Per spec §3.2 the MVP only ships `InternalTokenAuth`, so this surfaces
// "Paste your integration secret" as the only path. Phase 4 will add a real
// OAuth flow; the card structure stays the same — just adds a second row.

import { useState } from "react";
import type { FormEvent } from "react";
import { useStorageItem } from "~/storage/react";
import {
  notionTokenStorage,
  workspaceHintStorage,
} from "~/storage/items";
import type { UserHint } from "~/core/auth/AuthStrategy";

/**
 * Recognized Notion integration token prefixes.
 * Keep in lock-step with src/entrypoints/popup/components/AuthGate.tsx so the
 * popup's quick-paste (if it ever ships one) and the options page agree.
 */
const NOTION_TOKEN_PREFIXES = ["secret_", "ntn_"] as const;

const FAKE_HINT_FALLBACK: UserHint = {
  workspaceName: "Connected workspace",
};

function hintSummary(hint: UserHint | null): string {
  if (!hint) return "Notion workspace will be detected on first save.";
  if (hint.workspaceName) return `Connected to ${hint.workspaceName}`;
  if (hint.workspaceId) return `Connected (workspace ${hint.workspaceId.slice(0, 8)}\u2026)`;
  return "Connected.";
}

export default function AuthCard() {
  const { value: token, set: writeToken, remove: clearToken } =
    useStorageItem(notionTokenStorage);
  const { value: workspace } = useStorageItem(workspaceHintStorage);

  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!NOTION_TOKEN_PREFIXES.some((p) => trimmed.startsWith(p))) {
      setError(
        `This doesn\u2019t look like a Notion integration secret. Tokens start with one of: ${NOTION_TOKEN_PREFIXES.join(", ")}.`,
      );
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await writeToken(trimmed);
      setDraft("");
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function onSignOut() {
    if (
      !confirm(
        "Sign out? This removes your Notion token locally; you can paste a new one any time.",
      )
    ) {
      return;
    }
    await clearToken();
    setDraft("");
    setSavedAt(null);
  }

  const canSubmit = !!draft.trim() && !saving;
  const status = token
    ? savedAt && Date.now() - savedAt < 4000
      ? "Saved \u2713"
      : hintSummary(workspace ?? FAKE_HINT_FALLBACK)
    : "Not connected";

  return (
    <section className="nc-opt__card">
      <div className="nc-opt__card-head">
        <h2 className="nc-opt__card-title">Notion integration</h2>
        <p className="nc-opt__card-desc">
          Paste an internal-integration secret from{" "}
          <a
            href="https://www.notion.so/my-integrations"
            target="_blank"
            rel="noreferrer noopener"
          >
            notion.so/my-integrations
          </a>
          . Then share at least one database with the integration in Notion.
        </p>
      </div>

      <form className="nc-opt__card-body" onSubmit={onSubmit}>
        <div className="nc-opt__field">
          <label className="nc-opt__label" htmlFor="nc-opt-token">
            Integration secret
          </label>
          <div className="nc-opt__input-wrap">
            <input
              id="nc-opt-token"
              type={show ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="secret_\u2026 or ntn_\u2026"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="nc-opt__input"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="nc-opt__peek"
              aria-label={show ? "Hide token" : "Show token"}
              title={show ? "Hide" : "Show"}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <p className="nc-opt__hint">
            Stored in chrome.storage.local on this device. Never transmitted anywhere.
          </p>
        </div>

        {error && <p className="nc-opt__error">{error}</p>}

        <div className="nc-opt__btn-row">
          <button type="submit" disabled={!canSubmit} className="nc-opt__btn">
            {saving ? "Connecting\u2026" : token ? "Replace token" : "Connect"}
          </button>
          {token && (
            <button
              type="button"
              className="nc-opt__btn nc-opt__btn--danger"
              onClick={() => {
                void onSignOut();
              }}
            >
              Sign out
            </button>
          )}
          <span className="nc-opt__hint" aria-live="polite">
            {status}
          </span>
        </div>
      </form>
    </section>
  );
}
