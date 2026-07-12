// ClipperMain — shown after onboarding. The destination picker lists the
// data sources shared with the current Notion integration.

import { useEffect, useReducer, useState } from "react";
import type { ChangeEvent } from "react";
import { analyzeWithProvider, approvedNotionProperties, type DraftValue, type ReviewField } from "~/core/ai/analyze";
import { listNotionDataSources } from "~/core/notion/dataSources";
import { getAiFields } from "~/core/notion/fields";
import {
  createNotionClip,
  findNotionClipDuplicate,
  overwriteNotionClip,
  type CreateClipInput,
  type DuplicateNotionPage,
} from "~/core/notion/pages";
import { getActivePageMetadata } from "~/core/page/activeTab";
import { clipperFlowReducer, initialClipperFlow } from "~/core/clipper/flow";
import { mascotSpriteUrls } from "~/shared/branding";
import { useStorageItem } from "~/storage/react";
import {
  byokAnthropicKeyStorage,
  byokGeminiKeyStorage,
  byokOpenaiKeyStorage,
  byokOpenRouterKeyStorage,
  byokProviderStorage,
  lastUsedDbStorage,
  resolveByokProvider,
  sendFullPageTextToAiStorage,
} from "~/storage/items";
import ReviewDraft from "./ReviewDraft";
import SubmitAction from "./SubmitAction";
import DuplicateDialog from "./DuplicateDialog";

type PendingDuplicate = {
  clip: CreateClipInput;
  duplicate: DuplicateNotionPage;
  source: "quick" | "review" | "smart";
};

export default function ClipperMain({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const { value: lastDb, set: setLastDb } = useStorageItem(lastUsedDbStorage);
  const { value: provider, set: writeProvider } = useStorageItem(byokProviderStorage);
  const { value: openAiKey } = useStorageItem(byokOpenaiKeyStorage);
  const { value: anthropicKey } = useStorageItem(byokAnthropicKeyStorage);
  const { value: openRouterKey } = useStorageItem(byokOpenRouterKeyStorage);
  const { value: geminiKey } = useStorageItem(byokGeminiKeyStorage);
  const { value: sendFullPageText } = useStorageItem(sendFullPageTextToAiStorage);
  const [dataSources, setDataSources] = useState<ReadonlyArray<{ id: string; name: string }>>([]);
  const [db, setDb] = useState("");
  const [title, setTitle] = useState("");
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const [pageText, setPageText] = useState("");
  const [pageMetadataError, setPageMetadataError] = useState<string | null>(null);
  const [loadingDataSources, setLoadingDataSources] = useState(true);
  const [dataSourceError, setDataSourceError] = useState<string | null>(null);
  const [dataSourceReload, setDataSourceReload] = useState(0);
  const [flow, dispatchFlow] = useReducer(clipperFlowReducer, initialClipperFlow);
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null);
  const [overwriting, setOverwriting] = useState(false);
  const [overwriteError, setOverwriteError] = useState<string | null>(null);
  const [updatedDuplicateUrl, setUpdatedDuplicateUrl] = useState<string | null>(null);
  const [smartOverwrite, setSmartOverwrite] = useState<DuplicateNotionPage | null>(null);
  const activeProvider = resolveByokProvider(provider);
  const providerKey = {
    openai: openAiKey,
    anthropic: anthropicKey,
    openrouter: openRouterKey,
    gemini: geminiKey,
  }[activeProvider];

  useEffect(() => {
    if (provider === "nano") void writeProvider("openai");
  }, [provider, writeProvider]);

  useEffect(() => {
    let cancelled = false;
    async function loadDataSources() {
      setLoadingDataSources(true);
      setDataSourceError(null);
      try {
        const nextDataSources = await listNotionDataSources();
        if (cancelled) return;
        setDataSources(nextDataSources);
      } catch (reason) {
        if (!cancelled) {
          setDataSourceError(
            reason instanceof Error ? reason.message : "Could not load your Notion databases.",
          );
          setDataSources([]);
          setDb("");
        }
      } finally {
        if (!cancelled) setLoadingDataSources(false);
      }
    }
    void loadDataSources();
    return () => {
      cancelled = true;
    };
  }, [dataSourceReload]);

  useEffect(() => {
    setDb((current) => {
      if (lastDb && dataSources.some((source) => source.id === lastDb)) {
        return lastDb;
      }
      if (dataSources.some((source) => source.id === current)) return current;
      return dataSources[0]?.id ?? "";
    });
  }, [dataSources, lastDb]);

  useEffect(() => {
    let cancelled = false;
    void getActivePageMetadata()
      .then((metadata) => {
        if (cancelled) return;
        setPageUrl(metadata.url);
        setPageText(metadata.text);
        setTitle(metadata.title);
      })
      .catch((reason) => {
        if (!cancelled) {
          setPageMetadataError(
            reason instanceof Error ? reason.message : "Could not read the active page.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function reloadDataSources() {
    setDataSourceReload((count) => count + 1);
  }

  function onPickDb(e: ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setDb(id);
    void setLastDb(id);
  }

  function quickClipInput(): CreateClipInput {
    if (!pageUrl) throw new Error("Could not read the current page URL.");
    return {
      dataSourceId: db,
      title: title.trim(),
      url: pageUrl,
    };
  }

  function enrichedClipInput(): CreateClipInput {
    if (!pageUrl) throw new Error("Could not read the current page URL.");
    return {
      dataSourceId: db,
      title: title.trim(),
      url: pageUrl,
      properties: approvedNotionProperties(flow.screen === "review" ? flow.fields : []),
    };
  }

  async function saveClip(clip: CreateClipInput, source: PendingDuplicate["source"]) {
    const result = await createNotionClip(clip);
    if (result.kind === "duplicate") {
      setOverwriteError(null);
      setUpdatedDuplicateUrl(null);
      setPendingDuplicate({ clip, duplicate: result, source });
      return null;
    }
    return result;
  }

  async function saveQuickClip() {
    return saveClip(quickClipInput(), "quick");
  }

  async function saveEnrichedClip() {
    return saveClip(enrichedClipInput(), "review");
  }

  function dismissDuplicate() {
    setPendingDuplicate(null);
    setOverwriteError(null);
    setUpdatedDuplicateUrl(null);
  }

  async function overwriteDuplicate() {
    if (!pendingDuplicate) return;
    if (pendingDuplicate.source === "smart") {
      const duplicate = pendingDuplicate.duplicate;
      dismissDuplicate();
      setSmartOverwrite(duplicate);
      await analyzePage(true);
      return;
    }
    setOverwriting(true);
    setOverwriteError(null);
    try {
      const result = await overwriteNotionClip(pendingDuplicate.duplicate.pageId, pendingDuplicate.clip);
      if (pendingDuplicate.source === "review") {
        dismissDuplicate();
        dispatchFlow({ type: "approvalSaved", pageUrl: result.pageUrl });
      } else {
        setUpdatedDuplicateUrl(result.pageUrl);
      }
    } catch (reason) {
      setOverwriteError(reason instanceof Error ? reason.message : "Could not overwrite the existing clip.");
    } finally {
      setOverwriting(false);
    }
  }

  async function analyzePage(skipDuplicateCheck = false) {
    if (!pageUrl) return;
    try {
      if (!skipDuplicateCheck) {
        const clip = quickClipInput();
        const duplicate = await findNotionClipDuplicate(clip);
        if (duplicate) {
          setOverwriteError(null);
          setUpdatedDuplicateUrl(null);
          setPendingDuplicate({ clip, duplicate, source: "smart" });
          return;
        }
      }

      dispatchFlow({ type: "analysisStarted" });
      const fields = await getAiFields(db);
      if (fields.length === 0) {
        dispatchFlow({ type: "analysisReady", fields: [] });
        return;
      }
      if (!providerKey) {
        dispatchFlow({
          type: "analysisFailed",
          message: `Add and verify a ${activeProvider === "gemini" ? "Google Gemini" : activeProvider === "openrouter" ? "OpenRouter" : activeProvider === "anthropic" ? "Anthropic" : "OpenAI"} API key in Settings before analyzing.`,
        });
        return;
      }
      const analysis = await analyzeWithProvider({
        provider: activeProvider,
        apiKey: providerKey,
        page: {
          title,
          url: pageUrl,
          text: sendFullPageText ? pageText : pageText.slice(0, 1500),
        },
        fields,
      });
      dispatchFlow({ type: "analysisReady", fields: analysis });
    } catch (reason) {
      if (skipDuplicateCheck) setSmartOverwrite(null);
      dispatchFlow({
        type: "analysisFailed",
        message: reason instanceof Error ? reason.message : "Could not analyze this page.",
      });
    }
  }

  async function approveAndSave() {
    dispatchFlow({ type: "approvalStarted" });
    try {
      if (smartOverwrite) {
        const result = await overwriteNotionClip(smartOverwrite.pageId, enrichedClipInput());
        setSmartOverwrite(null);
        dispatchFlow({ type: "approvalSaved", pageUrl: result.pageUrl });
        return;
      }
      const result = await saveEnrichedClip();
      if (!result) {
        dispatchFlow({ type: "approvalDuplicate" });
        return;
      }
      dispatchFlow({ type: "approvalSaved", pageUrl: result.pageUrl });
    } catch (reason) {
      dispatchFlow({
        type: "approvalFailed",
        message: reason instanceof Error ? reason.message : "Could not save this clip.",
      });
    }
  }

  function updateReviewField(id: string, value: DraftValue) {
    dispatchFlow({ type: "reviewFieldChanged", id, value });
  }

  const duplicateDialog = pendingDuplicate && (
    <DuplicateDialog
      pageUrl={pendingDuplicate.duplicate.pageUrl}
      overwriting={overwriting}
      error={overwriteError}
      updatedPageUrl={updatedDuplicateUrl}
      actionLabel={pendingDuplicate.source === "smart" ? "Continue & overwrite" : "Overwrite"}
      description={pendingDuplicate.source === "smart"
        ? "Continue to prepare fields, then review before the existing row is replaced."
        : "The existing row will stay unchanged unless you overwrite it."}
      onCancel={dismissDuplicate}
      onOverwrite={() => void overwriteDuplicate()}
    />
  );

  if (flow.screen === "review") {
    return (
      <>
        <ReviewDraft
          title={title}
          url={pageUrl ?? ""}
          fields={flow.fields}
          onTitleChange={setTitle}
          onUrlChange={setPageUrl}
          onFieldChange={updateReviewField}
          onBack={() => {
            setSmartOverwrite(null);
            dispatchFlow({ type: "backToClip" });
          }}
          onApprove={() => void approveAndSave()}
          saving={flow.saving}
          savedPageUrl={flow.savedPageUrl}
        />
        {flow.saveError && <p className="nc-review__error" role="alert">{flow.saveError}</p>}
        {duplicateDialog}
      </>
    );
  }

  return (
    <>
    <div className="nc-main">
      <header className="nc-main__head">
        <div className="nc-main__brand">
          <div className="nc-main__sprites" aria-label="Notion Web Clipper">
            {mascotSpriteUrls.map((sprite) => <img key={sprite} src={sprite} alt="" />)}
          </div>
        </div>
        <button
          className="nc-icon-btn"
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          title="Settings"
        >
          {"\u2699"}
        </button>
      </header>

      <div className="nc-main__body">
        <label className="nc-title-field">
          <span className="nc-sr-only">Clip title</span>
          <textarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="nc-title-field__input"
            rows={3}
            aria-label="Clip title"
            placeholder="Loading page title..."
          />
        </label>
        {pageMetadataError ? (
          <p className="nc-page-source nc-page-source--error">{pageMetadataError}</p>
        ) : pageUrl ? (
          <p className="nc-page-source" title={pageUrl}>{pageUrl}</p>
        ) : (
          <p className="nc-page-source">Reading this page...</p>
        )}
        <label className="nc-field">
          <span className="nc-field__label">Add to</span>
          <select
            className="nc-field__select"
            value={db}
            onChange={onPickDb}
            disabled={loadingDataSources || !!dataSourceError || dataSources.length === 0}
          >
            {loadingDataSources && <option>Loading your Notion databases...</option>}
            {!loadingDataSources && dataSourceError && <option>Could not load databases</option>}
            {!loadingDataSources && !dataSourceError && dataSources.length === 0 && (
              <option>No shared databases found</option>
            )}
            {dataSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
          {dataSourceError ? (
            <span className="nc-field__hint nc-field__hint--error">
              {dataSourceError} <button type="button" onClick={reloadDataSources}>Retry</button>
            </span>
          ) : dataSources.length === 0 && !loadingDataSources ? (
            <span className="nc-field__hint">Share a database with this integration in Notion, then retry.</span>
          ) : (
            <span className="nc-field__hint">Your last destination is remembered.</span>
          )}
        </label>
      </div>

      <footer className="nc-main__foot">
        <div className="nc-clip-actions">
          <SubmitAction
            className="nc-save__btn--quick"
            disabled={!db || !pageUrl || !title.trim() || flow.analyzing}
            label="Quick Clip"
            savedLabel="Clipped"
            onSave={saveQuickClip}
          />
          <div className="nc-analyze">
          {flow.analysisError && <p className="nc-save__error" role="alert">{flow.analysisError}</p>}
          <button
            type="button"
            className="nc-save__btn nc-save__btn--smart"
            disabled={!db || !pageUrl || !title.trim() || flow.analyzing}
            onClick={() => void analyzePage()}
            title="Prepare database fields with AI before saving"
          >
            {flow.analyzing ? "Preparing..." : "Smart Clip"}
          </button>
          </div>
        </div>
      </footer>
    </div>
    {duplicateDialog}
    </>
  );
}
