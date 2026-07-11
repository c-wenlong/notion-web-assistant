// AdvancedCard — third card on the Options page. Two pieces:
//
//   1. "Send full page text to AI provider" toggle (spec §7.2). When OFF
//      (default), the extension summarizes / truncates the page body before
//      dispatching to the user's BYOK LLM. PyI is automatically stripped
//      (email/phone/credit-card candidates) regardless of toggle state.
//
//   2. Auth mode notice. MVP ships `InternalTokenAuth` only (spec §3.2);
//      Phase 4 flips to OAuthBackendAuth + a Cloudflare Worker backend.
//      We surface the current mode as read-only for now.

import { useStorageItem } from "~/storage/react";
import {
  authModeStorage,
  sendFullPageTextToAiStorage,
} from "~/storage/items";

function ToggleRow({
  title,
  description,
  checked,
  onChange,
  ariaLabel,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <label className="nc-opt__toggle-row">
      <span className="nc-opt__toggle-text">
        <span className="nc-opt__toggle-title">{title}</span>
        <span className="nc-opt__toggle-desc">{description}</span>
      </span>
      <span className="nc-opt__switch" aria-label={ariaLabel}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="nc-opt__switch-track" aria-hidden="true">
          <span className="nc-opt__switch-thumb" aria-hidden="true" />
        </span>
      </span>
    </label>
  );
}

export default function AdvancedCard() {
  const { value: sendFull, set: writeSendFull } = useStorageItem(
    sendFullPageTextToAiStorage,
  );
  const { value: authMode } = useStorageItem(authModeStorage);

  return (
    <section className="nc-opt__card">
      <div className="nc-opt__card-head">
        <h2 className="nc-opt__card-title">Privacy &amp; network</h2>
        <p className="nc-opt__card-desc">
          Controls how much of each page leaves your device. These preferences
          sync across your browsers; your BYOK keys never do (they live under
          chrome.storage.local on each device).
        </p>
      </div>

      <div className="nc-opt__card-body">
        <ToggleRow
          title="Send full page text to the AI provider"
          description="When OFF, the extension sends a title + first ~1,500 chars + automatic PII redaction (email, phone, credit-card patterns) before any extraction. Turn ON if you want every byte the AI sees."
          checked={sendFull ?? false}
          onChange={(next) => {
            void writeSendFull(next);
          }}
          ariaLabel="Send full page text to AI provider"
        />

        <p className="nc-opt__notice">
          <strong>Auth mode:</strong>{" "}
          {authMode === "oauth"
            ? "OAuth (Cloudflare Worker). Coming in Phase 4 \u2014 currently informational."
            : "Internal-token paste (MVP). Phase 4 will add an OAuth option for the public Chrome Web Store launch."}
        </p>
      </div>
    </section>
  );
}
