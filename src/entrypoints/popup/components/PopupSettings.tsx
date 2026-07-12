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
  defuddleEnabledStorage,
  notionTokenStorage,
  onboardingCompletedStorage,
  resolveByokProvider,
  themeStorage,
} from "~/storage/items";

type Mode = "onboarding" | "settings";
type SettingSection = "notion" | "ai" | "extraction" | "appearance";
type ConnectionState = "idle" | "checking" | "connected" | "error";

const PROVIDERS: ReadonlyArray<{ value: ByokProvider; label: string; placeholder: string; keyUrl: string }> = [
  { value: "openai", label: "OpenAI", placeholder: "sk-...", keyUrl: "https://platform.openai.com/api-keys" },
  { value: "anthropic", label: "Anthropic", placeholder: "sk-ant-...", keyUrl: "https://console.anthropic.com/settings/keys" },
  { value: "openrouter", label: "OpenRouter (Free)", placeholder: "sk-or-...", keyUrl: "https://openrouter.ai/keys" },
  { value: "gemini", label: "Google Gemini", placeholder: "AIza...", keyUrl: "https://aistudio.google.com/apikey" },
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

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function DatabasesPage({
  dataSources,
  refreshing,
  onBack,
  onRefresh,
}: {
  dataSources: ReadonlyArray<NotionDataSource>;
  refreshing: boolean;
  onBack: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="nc-databases-page">
      <header className="nc-databases-page__head">
        <button type="button" className="nc-back-btn" onClick={onBack} aria-label="Back to settings" title="Back">{"\u2190"}</button>
        <div>
          <p className="nc-settings__eyebrow">Notion connection</p>
          <h1 className="nc-settings__title">Databases</h1>
        </div>
        <button type="button" className="nc-databases-page__refresh" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>
      <p className="nc-databases-page__summary">{databaseSummary(dataSources.length)}</p>
      {dataSources.length > 0 ? (
        <ul className="nc-databases-page__list">
          {dataSources.map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer noopener" title={`Open ${source.name} in Notion`}>
                {source.name}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="nc-databases-page__empty">No databases are shared with this integration yet.</p>
      )}
    </div>
  );
}

export default function PopupSettings({ mode, onDone }: { mode: Mode; onDone: () => void }) {
  const { value: token, set: writeToken, remove: clearToken } = useStorageItem(notionTokenStorage);
  const { value: provider, set: writeProvider } = useStorageItem(byokProviderStorage);
  const { value: openaiKey, set: writeOpenaiKey } = useStorageItem(byokOpenaiKeyStorage);
  const { value: anthropicKey, set: writeAnthropicKey } = useStorageItem(byokAnthropicKeyStorage);
  const { value: openRouterKey, set: writeOpenRouterKey } = useStorageItem(byokOpenRouterKeyStorage);
  const { value: geminiKey, set: writeGeminiKey } = useStorageItem(byokGeminiKeyStorage);
  const { value: defuddleEnabled, set: writeDefuddleEnabled } = useStorageItem(defuddleEnabledStorage);
  const { value: theme, set: writeTheme } = useStorageItem(themeStorage);
  const { set: setOnboardingCompleted } = useStorageItem(onboardingCompletedStorage);

  const activeProvider = resolveByokProvider(provider);
  const activeDefuddleEnabled = defuddleEnabled ?? true;
  const activeTheme = theme ?? "system";
  const activeProviderInfo = providerInfo(activeProvider);
  const savedKey = {
    openai: openaiKey,
    anthropic: anthropicKey,
    openrouter: openRouterKey,
    gemini: geminiKey,
  }[activeProvider];

  const [openSection, setOpenSection] = useState<SettingSection | null>("notion");
  const [tokenDraft, setTokenDraft] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [notionState, setNotionState] = useState<ConnectionState>("idle");
  const [notionError, setNotionError] = useState<string | null>(null);
  const [dataSources, setDataSources] = useState<ReadonlyArray<NotionDataSource>>([]);
  const [showDatabases, setShowDatabases] = useState(false);
  const [aiState, setAiState] = useState<ConnectionState>("idle");
  const [aiError, setAiError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (openSection !== "notion" || !token || notionState !== "idle") return;

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
    if (provider === "nano") void writeProvider("openai");
  }, [provider, writeProvider]);

  useEffect(() => {
    if (openSection !== "ai") return;
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
    aiState === "checking"
      ? "Checking connection"
      : aiState === "connected"
        ? "Connected"
        : savedKey
          ? "Check connection"
          : "No key connected";

  if (showDatabases) {
    return (
      <DatabasesPage
        dataSources={dataSources}
        refreshing={notionState === "checking"}
        onBack={() => setShowDatabases(false)}
        onRefresh={() => void connectNotion()}
      />
    );
  }

  return (
    <div className="nc-settings">
      <header className="nc-settings__head">
        {!isOnboarding && (
          <button type="button" className="nc-back-btn" onClick={onDone} aria-label="Back to clipper" title="Back">
            {"\u2190"}
          </button>
        )}
        <div>
          {isOnboarding ? (
            <>
              <p className="nc-settings__eyebrow">Welcome</p>
              <h1 className="nc-settings__title">Set up Notion Web Clipper</h1>
            </>
          ) : (
            <h1 className="nc-settings__title">Settings</h1>
          )}
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
            <label className="nc-settings__label" htmlFor="popup-notion-token">Integration secret</label>
            <div className="nc-settings__input-wrap">
              <input
                id="popup-notion-token"
                type={showToken ? "text" : "password"}
                value={tokenDraft}
                onChange={(event) => setTokenDraft(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="nc-settings__input"
              />
              <button type="button" className="nc-settings__reveal" onClick={() => setShowToken((value) => !value)}>
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
            <p className="nc-settings__field-note">Paste an internal integration secret. It stays on this device.</p>
            <div className="nc-settings__actions">
              <button type="button" className="nc-settings__action" onClick={() => void connectNotion()} disabled={notionState === "checking"}>
                {notionState === "checking" ? "Checking..." : token ? "Check connection" : "Connect Notion"}
              </button>
              <a className="nc-settings__link" href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer noopener">
                Create Notion integration
              </a>
            </div>

            {notionError && <p className="nc-settings__error" role="alert">{notionError}</p>}
            {notionState === "connected" && (
              <div className="nc-settings__database-summary" aria-live="polite">
                <span>{databaseSummary(dataSources.length)}</span>
                <button type="button" className="nc-settings__text-btn" onClick={() => setShowDatabases(true)}>
                  Show all
                </button>
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
            <a
              className="nc-settings__link"
              href={activeProviderInfo.keyUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Get API key
            </a>
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
            {activeProvider === "openrouter" && (
              <p className="nc-settings__notice">
                <span className="nc-settings__tag">Free</span>
                Smart Clip uses OpenRouter's free model router. An OpenRouter API key is still required.
              </p>
            )}
            {aiError && <p className="nc-settings__error" role="alert">{aiError}</p>}
          </div>
        )}
      </section>

      <section className={`nc-settings__item ${openSection === "extraction" ? "is-open" : ""}`}>
        <button
          type="button"
          className="nc-settings__trigger"
          aria-expanded={openSection === "extraction"}
          aria-controls="popup-settings-extraction"
          onClick={() => toggleSection("extraction")}
        >
          <span className="nc-settings__summary">
            <span className="nc-settings__summary-title">Content extraction</span>
            <span className="nc-settings__status">
              {activeDefuddleEnabled ? "Clean page content" : "Use original page text"}
            </span>
          </span>
          <span className="nc-settings__chevron" aria-hidden="true" />
        </button>
        {openSection === "extraction" && (
          <div id="popup-settings-extraction" className="nc-settings__panel">
            <p className="nc-settings__panel-copy">
              Remove navigation, ads, and other page clutter before Smart Clip sends text to your AI provider.
            </p>
            <label className="nc-switch-row">
              <span>Use Defuddle</span>
              <input
                type="checkbox"
                checked={activeDefuddleEnabled}
                onChange={(event) => void writeDefuddleEnabled(event.target.checked)}
              />
              <span className="nc-switch" aria-hidden="true" />
            </label>
          </div>
        )}
      </section>

      <section className={`nc-settings__item ${openSection === "appearance" ? "is-open" : ""}`}>
        <button
          type="button"
          className="nc-settings__trigger"
          aria-expanded={openSection === "appearance"}
          aria-controls="popup-settings-appearance"
          onClick={() => toggleSection("appearance")}
        >
          <span className="nc-settings__summary">
            <span className="nc-settings__summary-title">Appearance</span>
            <span className="nc-settings__status">{activeTheme === "system" ? "Use system setting" : `${capitalize(activeTheme)} mode`}</span>
          </span>
          <span className="nc-settings__chevron" aria-hidden="true" />
        </button>
        {openSection === "appearance" && (
          <div id="popup-settings-appearance" className="nc-settings__panel">
            <p className="nc-settings__panel-copy">Choose how Notion Web Clipper looks on this device.</p>
            <div className="nc-settings__theme-picker" role="group" aria-label="Appearance">
              {(["system", "light", "dark"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`nc-settings__theme-option ${activeTheme === option ? "is-selected" : ""}`}
                  aria-pressed={activeTheme === option}
                  onClick={() => void writeTheme(option)}
                >
                  {capitalize(option)}
                </button>
              ))}
            </div>
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
