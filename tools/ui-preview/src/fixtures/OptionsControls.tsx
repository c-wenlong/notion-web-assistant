// Side panel of mock controls for the Options view. Drives:
//
//   - BYOK provider choice
//   - 4 per-provider BYOK key fields (OpenAI / Anthropic / OpenRouter / Gemini)
//   - Send-full-page-text PII toggle (off by default per spec §7.2)
//   - Auth mode (info-only in MVP Phase 4 placeholder)
//
// All writes go through the popup's real `useStorageItem` hook so the
// Options page render path is genuine. Token state is shared with the
// Popup tab via the in-memory shim — toggling "Sign in (fake)" on
// PageControls updates the AuthCard's status line in real time.

import { useState } from "react";
import { useStorageItem } from "~/storage/react";
import type { ByokProvider } from "~/storage/items";
import {
  authModeStorage,
  byokAnthropicKeyStorage,
  byokGeminiKeyStorage,
  byokOpenaiKeyStorage,
  byokOpenRouterKeyStorage,
  byokProviderStorage,
  notionTokenStorage,
  sendFullPageTextToAiStorage,
  workspaceHintStorage,
} from "~/storage/items";

const PROVIDER_OPTIONS: ReadonlyArray<{ id: ByokProvider; label: string }> = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openrouter", label: "OpenRouter (Free)" },
  { id: "gemini", label: "Google Gemini" },
];

const FAKE_OPENAI_KEY = "sk-PREVIEW_OPENAI_KEY_replace_with_real";
const FAKE_ANTHROPIC_KEY = "sk-ant-PREVIEW_ANTHROPIC_KEY_replace_with_real";
const FAKE_OPENROUTER_KEY = "sk-or-PREVIEW_OPENROUTER_KEY_replace_with_real";
const FAKE_GEMINI_KEY = "AIzaSyPREVIEW_GEMINI_KEY_replace_with_real";

// Each per-provider key storage item gets a stable hook instance so we can
// call .set(...) from event handlers without violating the "hooks only in
// component renders" rule. React doesn't care about multiple useStorageItem
// calls because each item is a module-singleton identity.
function useAllByokKeys() {
  return {
    openai: useStorageItem(byokOpenaiKeyStorage),
    anthropic: useStorageItem(byokAnthropicKeyStorage),
    openrouter: useStorageItem(byokOpenRouterKeyStorage),
    gemini: useStorageItem(byokGeminiKeyStorage),
  };
}

export function OptionsControls() {
  const { value: provider, set: writeProvider } =
    useStorageItem(byokProviderStorage);
  const { value: sendFull, set: writeSendFull } = useStorageItem(
    sendFullPageTextToAiStorage,
  );
  const { value: authMode, set: writeAuthMode } = useStorageItem(authModeStorage);
  const { value: token } = useStorageItem(notionTokenStorage);
  const { value: workspace } = useStorageItem(workspaceHintStorage);
  const { openai, anthropic, openrouter, gemini } = useAllByokKeys();

  const [showAdvanced, setShowAdvanced] = useState(false);

  async function seedAllKeys() {
    await Promise.all([
      openai.set(FAKE_OPENAI_KEY),
      anthropic.set(FAKE_ANTHROPIC_KEY),
      openrouter.set(FAKE_OPENROUTER_KEY),
      gemini.set(FAKE_GEMINI_KEY),
    ]);
  }

  async function clearAllKeys() {
    await Promise.all([
      openai.set(null),
      anthropic.set(null),
      openrouter.set(null),
      gemini.set(null),
    ]);
  }

  function dispatchAuthMode(next: "internal" | "oauth") {
    void writeAuthMode(next);
  }

  return (
    <div className="preview__controls">
      <div className="preview__ctl">
        <span className="preview__ctl-label">BYOK provider</span>
        <select
          className="preview__select"
          value={provider === "nano" ? "openai" : provider ?? "openai"}
          onChange={(e) => void writeProvider(e.target.value as ByokProvider)}
        >
          {PROVIDER_OPTIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="preview__status">
          {`${provider === "nano" ? "openai" : provider ?? "openai"} selected \u2192 key field visible`}
        </span>
      </div>

      <div className="preview__ctl">
        <span className="preview__ctl-label">BYOK keys (per provider)</span>
        <div className="preview__row">
          <button
            type="button"
            className="preview__btn"
            onClick={() => {
              void seedAllKeys();
            }}
          >
            Seed all
          </button>
          <button
            type="button"
            className="preview__btn preview__btn--ghost"
            onClick={() => {
              void clearAllKeys();
            }}
          >
            Clear all
          </button>
        </div>
        <span className="preview__status">
          {openai.value ? "openai \u2713 " : "openai \u2013 "}
          {anthropic.value ? "anthropic \u2713 " : "anthropic \u2013 "}
          {openrouter.value ? "openrouter \u2713 " : "openrouter \u2013 "}
          {gemini.value ? "gemini \u2713" : "gemini \u2013"}
        </span>
      </div>

      <div className="preview__ctl">
        <span className="preview__ctl-label">Send full page text to AI</span>
        <label className="preview__toggle-inline">
          <input
            type="checkbox"
            checked={sendFull ?? false}
            onChange={(e) => void writeSendFull(e.target.checked)}
          />
          <span>{sendFull ? "On" : "Off (default)"}</span>
        </label>
      </div>

      <div className="preview__ctl">
        <span className="preview__ctl-label">Auth mode (read mostly)</span>
        <select
          className="preview__select"
          value={authMode ?? "internal"}
          onChange={(e) => dispatchAuthMode(e.target.value as "internal" | "oauth")}
        >
          <option value="internal">internal (MVP)</option>
          <option value="oauth">oauth (Phase 4 placeholder)</option>
        </select>
      </div>

      <div className="preview__ctl">
        <span className="preview__ctl-label">Connected Notion</span>
        <span className="preview__status">
          {token
            ? workspace
              ? `Connected \u00b7 ${workspace.workspaceName ?? (workspace.workspaceId?.slice(0, 8) + "\u2026")}`
              : "Connected \u00b7 (no workspace hint yet)"
            : "No token \u2192 AuthCard shows Connect form"}
        </span>
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
{`// \u00b7 The Options page reuses the parent's useStorageItem hook.
// \u00b7 notionTokenStorage writes from the Popup tab propagate across
//   views \u2014 toggling \u201cSign in (fake)\u201d on PageControls while on the
//   Options tab lights up the saved-token status here.
// \u00b7 BYOK keys: four separate items, no JSON blob. Lets a per-provider
//   wipe without touching the others (per spec §3.4 privacy posture).
// \u00b7 sendFullPageTextToAiStorage lives in sync: so it follows the user
//   across devices \u2014 but the BYOK keys themselves do NOT (local: only).`}
        </pre>
      )}
    </div>
  );
}
