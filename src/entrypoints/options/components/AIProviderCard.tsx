// AIProviderCard — second card on the Options page. Lets the user pick one
// of supported cloud AI providers and paste a corresponding API key.
//
// The actual `core/ai/router.ts` decision logic (when it lands) reads
// `byokProviderStorage` + the per-provider key storage items and routes the
// request. This card is the source-of-truth UI for those settings.

import { useEffect, useState } from "react";
import type { ByokProvider } from "~/storage/items";
import { useStorageItem } from "~/storage/react";
import {
  byokAnthropicKeyStorage,
  byokGeminiKeyStorage,
  byokOpenaiKeyStorage,
  byokOpenRouterKeyStorage,
  byokProviderStorage,
  resolveByokProvider,
} from "~/storage/items";

interface ProviderDescriptor {
  id: ByokProvider;
  shortLabel: string;
  helpUrl: string;
  keyPlaceholder: string;
  /** What this key looks like; used to give the user a hint when filling in. */
  keyFormat: string;
}

const PROVIDERS: ReadonlyArray<ProviderDescriptor> = [
  {
    id: "openai",
    shortLabel: "OpenAI",
    helpUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-\u2026",
    keyFormat: "Starts with sk-",
  },
  {
    id: "anthropic",
    shortLabel: "Anthropic",
    helpUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-\u2026",
    keyFormat: "Starts with sk-ant-",
  },
  {
    id: "openrouter",
    shortLabel: "OpenRouter",
    helpUrl: "https://openrouter.ai/keys",
    keyPlaceholder: "sk-or-\u2026",
    keyFormat: "Starts with sk-or-",
  },
  {
    id: "gemini",
    shortLabel: "Google Gemini",
    helpUrl: "https://aistudio.google.com/apikey",
    keyPlaceholder: "AIza\u2026",
    keyFormat: "Starts with AIza",
  },
];

function keyStorageFor(provider: ByokProvider) {
  switch (provider) {
    case "openai":
      return byokOpenaiKeyStorage;
    case "anthropic":
      return byokAnthropicKeyStorage;
    case "openrouter":
      return byokOpenRouterKeyStorage;
    case "gemini":
      return byokGeminiKeyStorage;
  }
}

function shortProvider(p: ByokProvider): ProviderDescriptor {
  // noUncheckedIndexedAccess: PROVIDERS always contains all supported providers.
  const found = PROVIDERS.find((d) => d.id === p);
  if (!found) {
    throw new Error(`AIProviderCard: unknown provider "${p}"`);
  }
  return found;
}

interface KeyFieldProps {
  provider: ProviderDescriptor;
}

function KeyField({ provider }: KeyFieldProps) {
  const storage = keyStorageFor(provider.id);
  const { value: key, set: writeKey } = useStorageItem(storage);
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);

  async function onSave() {
    const trimmed = draft.trim();
    await writeKey(trimmed || null);
    setDraft("");
  }

  async function onClear() {
    await writeKey(null);
    setDraft("");
  }

  // Render: stable persisted-value indicator + an editable draft + Save.
  return (
    <div className="nc-opt__field">
      <label className="nc-opt__label" htmlFor={`nc-opt-key-${provider.id}`}>
        {provider.shortLabel} API key
      </label>
      <div className="nc-opt__input-wrap">
        <input
          id={`nc-opt-key-${provider.id}`}
          type={show ? "text" : "password"}
          autoComplete="off"
          spellCheck={false}
          placeholder={
            key ? `${key.slice(0, 4)}\u2026\u2026\u2026 (saved)` : provider.keyPlaceholder
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="nc-opt__input"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="nc-opt__peek"
          aria-label={show ? "Hide key" : "Show key"}
          title={show ? "Hide" : "Show"}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <p className="nc-opt__hint">
        {key ? "A key is saved for this provider." : provider.keyFormat}
        {" "}
        Get one at{" "}
        <a href={provider.helpUrl} target="_blank" rel="noreferrer noopener">
          {provider.helpUrl.replace(/^https?:\/\//, "")}
        </a>
        .
      </p>
      <div className="nc-opt__btn-row">
        <button
          type="button"
          className="nc-opt__btn"
          disabled={!draft.trim()}
          onClick={() => {
            void onSave();
          }}
        >
          Save key
        </button>
        {key && (
          <button
            type="button"
            className="nc-opt__btn nc-opt__btn--ghost"
            onClick={() => {
              void onClear();
            }}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export default function AIProviderCard() {
  const { value: provider, set: writeProvider } =
    useStorageItem(byokProviderStorage);
  const active = resolveByokProvider(provider);
  const activeDescriptor = shortProvider(active);

  useEffect(() => {
    if (provider === "nano") void writeProvider("openai");
  }, [provider, writeProvider]);

  return (
    <section className="nc-opt__card">
      <div className="nc-opt__card-head">
        <h2 className="nc-opt__card-title">AI provider</h2>
        <p className="nc-opt__card-desc">
          Pick the model that powers recipe extraction, summaries, and field
          inference. Smart Clip runs through the selected provider. OpenRouter
          uses its free model router and still requires an API key.
        </p>
      </div>

      <div className="nc-opt__card-body">
        <div className="nc-opt__field">
          <span className="nc-opt__label" id="nc-opt-providers-label">
            Active provider
          </span>
          <div
            className="nc-opt__providers"
            role="radiogroup"
            aria-labelledby="nc-opt-providers-label"
          >
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={p.id === active}
                aria-pressed={p.id === active}
                className="nc-opt__provider"
                onClick={() => {
                  void writeProvider(p.id);
                }}
                title={`Use ${p.shortLabel} with your own API key`}
              >
                {p.shortLabel}
                {p.id === "openrouter" && <span className="nc-opt__provider-tag">Free</span>}
              </button>
            ))}
          </div>
        </div>

        <KeyField provider={activeDescriptor} />

        <div className="nc-opt__btn-row">
          <button
            type="button"
            className="nc-opt__btn nc-opt__btn--ghost"
            disabled
            title="Wired up when core/ai/router.ts lands in Phase 1.5"
          >
            Test connection
          </button>
          <span className="nc-opt__hint">
            Provider choice and keys are saved per device; the &ldquo;Use BYOK&rdquo;
            preference roams via sync.
          </span>
        </div>
      </div>
    </section>
  );
}
