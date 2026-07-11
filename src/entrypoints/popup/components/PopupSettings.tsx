import { useEffect, useState } from "react";
import { validateAiProvider } from "~/core/ai/connection";
import { listNotionDataSources, type NotionDataSource } from "~/core/notion/dataSources";
import { useStorageItem } from "~/storage/react";
import type { ByokProvider } from "~/storage/items";
import {
  byokAnthropicKeyStorage,
  byokGeminiKeyStorage,
  byokOpenaiKeyStorage,
  byokOpenRouterKeyStorage,
  byokProviderStorage,
  notionTokenStorage,
  onboardingCompletedStorage,
  sendFullPageTextToAiStorage,
} from "~/storage/items";

type Mode = "onboarding" | "settings";
type SettingSection = "notion" | "ai" | "privacy";
type ConnectionState = "idle" | "checking" | "connected" | "error";

const PROVIDERS: ReadonlyArray<{ value: ByokProvider; label: string; placeholder: string }> = [
  { value: "nano", label: "Nano (on-device)", placeholder: "" },
  { value: "openai", label: "OpenAI", placeholder: "sk-..." },
  { value: "anthropic", label: "Anthropic", placeholder: "sk-ant-..." },
  { value: "openrouter", label: "OpenRouter", placeholder: "sk-or-..." },
  { value: "gemini", label: "Gemini", placeholder: "AIza..." },
];

function providerInfo(provider: ByokProvider) {
  const found = PROVIDERS.find((item) => item.value === provider);
  if (!found) throw new Error(`Unknown AI provider: ${provider}`);
  return found;
}

function isNotionToken(value: string) {
  return value.startsWith("secret_") || value.startsWith("ntn_");
}

function databaseSummary(count: number): string {
  return `${count} ${count === 1 ? "database" : "databases"} available`;
}

export default function PopupSettings({ mode, onDone }: { mode: Mode; onDone: () => void }) {
  const { value: token, set: writeToken, remove: clearToken } = useStorageItem(notionTokenStorage);
  const { value: provider, set: writeProvider } = useStorageItem(byokProviderStorage);
  const { value: openaiKey, set: writeOpenaiKey } = useStorageItem(byokOpenaiKeyStorage);
  const { value: anthropicKey, set: writeAnthropicKey } = useStorageItem(byokAnthropicKeyStorage);
  const { value: openRouterKey, set: writeOpenRouterKey } = useStorageItem(byokOpenRouterKeyStorage);
  const { value: geminiKey, set: writeGeminiKey } = useStorageItem(byokGeminiKeyStorage);
  const { value: sendFullPageText, set: writeSendFullPageText } = useStorageItem(sendFullPageTextToAiStorage);
  const { set: setOnboardingCompleted } = useStorageItem(onboardingCompletedStorage);

  const activeProvider = provider ?? "nano";
  const activeProviderInfo = providerInfo(activeProvider);
  const savedKey = {
    openai: openaiKey,
    anthropic: anthropicKey,
    openrouter: openRouterKey,
    gemini: geminiKey,
    nano: null,
  }[activeProvider];

  const [openSection, setOpenSection] = useState<SettingSection | null>("notion");
  const [tokenDraft, setTokenDraft] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [notionState, setNotionState] = useState<ConnectionState>("idle");
  const [notionError, setNotionError] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<ReadonlyArray<NotionDataSource>>([]);
  const [aiState, setAiState] = useState<ConnectionState>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (openSection !== "notion" || !token) return;

    let cancelled = false;
    setNotionState("checking");
    setNotionError(null);
    void listNotionDataSources()
      .then((sources) => {
        if (cancelled) return;
        setDataSources(sources);
        setNotionState("connected");
      })
      .catch((reason) => {
        if (cancelled) return;
        setDataSources([]);
        setNotionState("error");
        setNotionError(reason instanceof Error ? reason.message : "Could not check your Notion connection.");
      });

    return () => {
      cancelled = true;
    };
  }, [openSection, token]);

  useEffect(() => {
    if (openSection !== "ai") return;
    if (activeProvider === "nano") {
      setAiState("idle");
      setAiError(null);
      return;
    }
    if (!savedKey) {
      setAiState("idle");
      setAiError(null);
      return;
    }

    let cancelled = false;
    setAiState("checking");
    setAiError(null);
    void validateAiProvider(activeProvider, savedKey)
      .then(() => {
        if (!cancelled) setAiState("connected");
      })
      .catch((reason) => {
        if (cancelled) return;
        setAiState("error");
        setAiError(reason instanceof Error ? reason.message : "Could not check that API key.");
      });

    return () => {
      cancelled = true;
    };
  }, [activeProvider, openSection, savedKey]);

  async function saveActiveKey(value: string) {
    switch (activeProvider) {
      case "openai":
        await writeOpenaiKey(value);
        break;
      case "anthropic":
        await writeAnthropicKey(value);
        break;
      case "openrouter":
        await writeOpenRouterKey(value);
        break;
      case "gemini":
        await writeGeminiKey(value);
        break;
      case "nano":
        break;
    }
  }

  function toggleSection(section: SettingSection) {
    setOpenSection((current) => current === section ? null : section);
  }

  async function connectNotion() {
    const nextToken = tokenDraft.trim();
    if (!token && !nextToken) {
      setNotionError("Paste your Notion integration secret to connect.");
      setNotionState("error");
      return;
    }
    if (nextToken && !isNotionToken(nextToken)) {
      setNotionError("Notion integration secrets start with secret_ or ntn_.");
      setNotionState("error");
      return;
    }

    const previousToken = token;
    const isReplacingToken = Boolean(nextToken);
    setNotionState("checking");
    setNotionError(null);
    try {
      if (isReplacingToken) await writeToken(nextToken);
      const sources = await listNotionDataSources();
      setDataSources(sources);
      setTokenDraft("");
      setNotionState("connected");
    } catch (reason) {
      if (isReplacingToken) {
        if (previousToken) await writeToken(previousToken);
        else await clearToken();
      }
      setDataSources([]);
      setNotionState("error");
      setNotionError(reason instanceof Error ? reason.message : "Could not check your Notion connection.");
    }
  }

  async function checkAiConnection() {
    const nextKey = keyDraft.trim() || savedKey;
    if (!nextKey) {
      setAiState("error");
      setAiError("Paste an API key before checking the connection.");
      return;
    }

    setAiState("checking");
    setAiError(null);
    try {
      await validateAiProvider(activeProvider, nextKey);
      if (keyDraft.trim()) await saveActiveKey(keyDraft.trim());
      setKeyDraft("");
      setAiState("connected");
    } catch (reason) {
      setAiState("error");
      setAiError(reason instanceof Error ? reason.message : "Could not check that API key.");
    }
  }

  async function forgetConnection() {
    await clearToken();
    await setOnboardingCompleted(false);
    setTokenDraft("");
    setDataSources([]);
    setNotionError(null);
    setNotionState("idle");
  }

  async function finishOnboarding() {
    if (notionState !== "connected") {
      setOpenSection("notion");
      setNotionState("error");
      setNotionError("Connect Notion before starting to clip.");
      return;
    }

    setFinishing(true);
    try {
      await setOnboardingCompleted(true);
      onDone();
    } finally {
      setFinishing(false);
    }
  }

  const isOnboarding = mode === "onboarding";
  const notionSummary =
    notionState === "checking"
      ? "Checking connection"
      : notionState === "connected"
        ? databaseSummary(dataSources.length)
        : token
          ? "Check connection"
          : "Not connected";
  const aiSummary =
    activeProvider === "nano"
      ? "On-device"
      : aiState === "checking"
        ? "Checking connection"
        : aiState === "connected"
          ? "Connected"
          : savedKey
            ? "Check connection"
            : "No key connected";

  return (
    <div className="nc-settings">
      <header className="nc-settings__head">
        {!isOnboarding && (
          <button type="button" className="nc-back-btn" onClick={onDone} aria-label="Back to clipper" title="Back">
            {"\u2190"}
          </button>
        )}
        <div>
          <p className="nc-settings__eyebrow">{isOnboarding ? "Welcome" : "Settings"}</p>
          <h1 className="nc-settings__title">{isOnboarding ? "Set up Nova Clipper" : "Your clipper"}</h1>
        </div>
      </header>

      {isOnboarding && <p className="nc-settings__intro">Connect Notion once, then keep clipping from this panel.</p>}

      <section className={`nc-settings__item ${openSection === "notion" ? "is-open" : ""}`}>
        <button
          type="button"
          className="nc-settings__trigger"
          aria-expanded={openSection === "notion"}
          aria-controls="popup-settings-notion"
          onClick={() => toggleSection("notion")}
        >
          <span className="nc-settings__step" aria-hidden="true">1</span>
          <span className="nc-settings__summary">
            <span className="nc-settings__summary-title">Notion connection</span>
            <span className={`nc-settings__status ${notionState === "connected" ? "nc-settings__status--connected" : ""}`}>
              {notionSummary}
            </span>
          </span>
          <span className="nc-settings__chevron" aria-hidden="true" />
        </button>
        {openSection === "notion" && (
          <div id="popup-settings-notion" className="nc-settings__panel">
            <p className="nc-settings__panel-copy">Paste an internal integration secret. It stays on this device.</p>
            <label className="nc-settings__label" htmlFor="popup-notion-token">Integration secret</label>
            <div className="nc-settings__input-wrap">
              <input
                id="popup-notion-token"
                type={showToken ? "text" : "password"}
                value={tokenDraft}
                onChange={(event) => setTokenDraft(event.target.value)}
                placeholder={token ? "Connected - paste a new secret to replace" : "secret_... or ntn_..."}
                autoComplete="off"
                spellCheck={false}
                className="nc-settings__input"
              />
              <button type="button" className="nc-settings__reveal" onClick={() => setShowToken((value) => !value)}>
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <div className="nc-settings__actions">
              <button type="button" className="nc-settings__action" onClick={() => void connectNotion()} disabled={notionState === "checking"}>
                {notionState === "checking" ? "Checking..." : token ? "Check connection" : "Connect Notion"}
              </button>
              <a className="nc-settings__link" href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer noopener">
                Create an integration in Notion
              </a>
            </div>

            {notionError && <p className="nc-settings__error" role="alert">{notionError}</p>}
            {notionState === "connected" && (
              <div className="nc-settings__databases" aria-live="polite">
                <div className="nc-settings__databases-head">
                  <span>Databases this integration can access</span>
                  <button type="button" className="nc-settings__text-btn" onClick={() => void connectNotion()}>
                    Refresh
                  </button>
                </div>
                {dataSources.length > 0 ? (
                  <ul className="nc-settings__database-list">
                    {dataSources.map((source) => <li key={source.id} title={source.name}>{source.name}</li>)}
                  </ul>
                ) : (
                  <p className="nc-settings__empty">No databases are shared with this integration yet.</p>
                )}
              </div>
            )}
            {token && (
              <button type="button" className="nc-settings__danger" onClick={() => void forgetConnection()}>
                Disconnect Notion
              </button>
            )}
          </div>
        )}
      </section>

      <section className={`nc-settings__item ${openSection === "ai" ? "is-open" : ""}`}>
        <button
          type="button"
          className="nc-settings__trigger"
          aria-expanded={openSection === "ai"}
          aria-controls="popup-settings-ai"
          onClick={() => toggleSection("ai")}
        >
          <span className="nc-settings__step" aria-hidden="true">2</span>
          <span className="nc-settings__summary">
            <span className="nc-settings__summary-title">AI provider</span>
            <span className={`nc-settings__status ${aiState === "connected" ? "nc-settings__status--connected" : ""}`}>
              {aiSummary}
            </span>
          </span>
          <span className="nc-settings__chevron" aria-hidden="true" />
        </button>
        {openSection === "ai" && (
          <div id="popup-settings-ai" className="nc-settings__panel">
            <p className="nc-settings__panel-copy">Connect a provider to analyze pages and prepare field values.</p>
            <label className="nc-settings__label" htmlFor="popup-ai-provider">Provider</label>
            <select
              id="popup-ai-provider"
              className="nc-settings__select"
              value={activeProvider}
              onChange={(event) => {
                setKeyDraft("");
                setAiState("idle");
                setAiError(null);
                void writeProvider(event.target.value as ByokProvider);
              }}
            >
              {PROVIDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>

            {activeProvider === "nano" ? (
              <p className="nc-settings__notice">Nano runs on-device and does not need an API key.</p>
            ) : (
              <>
                <label className="nc-settings__label" htmlFor="popup-ai-key">API key</label>
                <div className="nc-settings__input-wrap">
                  <input
                    id="popup-ai-key"
                    type={showKey ? "text" : "password"}
                    value={keyDraft}
                    onChange={(event) => setKeyDraft(event.target.value)}
                    placeholder={savedKey ? "A key is saved - paste a new key to replace" : activeProviderInfo.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    className="nc-settings__input"
                  />
                  <button type="button" className="nc-settings__reveal" onClick={() => setShowKey((value) => !value)}>
                    {showKey ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="nc-settings__actions">
                  <button
                    type="button"
                    className="nc-settings__action"
                    onClick={() => void checkAiConnection()}
                    disabled={aiState === "checking" || (!keyDraft.trim() && !savedKey)}
                  >
                    {aiState === "checking" ? "Checking..." : keyDraft.trim() || !savedKey ? "Check and save key" : "Check saved key"}
                  </button>
                </div>
                {activeProvider !== "openai" && (
                  <p className="nc-settings__notice">The key is verified here; page analysis currently uses OpenAI.</p>
                )}
                {aiError && <p className="nc-settings__error" role="alert">{aiError}</p>}
              </>
            )}
          </div>
        )}
      </section>

      <section className={`nc-settings__item ${openSection === "privacy" ? "is-open" : ""}`}>
        <button
          type="button"
          className="nc-settings__trigger"
          aria-expanded={openSection === "privacy"}
          aria-controls="popup-settings-privacy"
          onClick={() => toggleSection("privacy")}
        >
          <span className="nc-settings__step" aria-hidden="true">3</span>
          <span className="nc-settings__summary">
            <span className="nc-settings__summary-title">Privacy</span>
            <span className="nc-settings__status">{sendFullPageText ? "Full page text" : "Limited page text"}</span>
          </span>
          <span className="nc-settings__chevron" aria-hidden="true" />
        </button>
        {openSection === "privacy" && (
          <div id="popup-settings-privacy" className="nc-settings__panel">
            <p className="nc-settings__panel-copy">Choose how much page content an AI provider receives.</p>
            <label className="nc-switch-row">
              <span>Send the full page text</span>
              <input
                type="checkbox"
                checked={sendFullPageText ?? false}
                onChange={(event) => void writeSendFullPageText(event.target.checked)}
              />
              <span className="nc-switch" aria-hidden="true" />
            </label>
          </div>
        )}
      </section>

      {isOnboarding && (
        <footer className="nc-settings__foot">
          <button type="button" className="nc-settings__primary" disabled={finishing} onClick={() => void finishOnboarding()}>
            {finishing ? "Starting..." : "Start clipping"}
          </button>
        </footer>
      )}
    </div>
  );
}
