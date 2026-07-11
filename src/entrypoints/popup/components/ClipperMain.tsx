// ClipperMain — shown after onboarding. The destination picker lists the
// data sources shared with the current Notion integration.

import { useEffect, useReducer, useState } from "react";
import type { ChangeEvent } from "react";
import { analyzeWithOpenAi, approvedNotionProperties, type DraftValue, type ReviewField } from "~/core/ai/analyze";
import { listNotionDataSources } from "~/core/notion/dataSources";
import { getAiFields } from "~/core/notion/fields";
import { createNotionClip } from "~/core/notion/pages";
import { getActivePageMetadata } from "~/core/page/activeTab";
import { clipperFlowReducer, initialClipperFlow } from "~/core/clipper/flow";
import { mascotUrl } from "~/shared/branding";
import { useStorageItem } from "~/storage/react";
import {
  byokOpenaiKeyStorage,
  byokProviderStorage,
  lastUsedDbStorage,
  sendFullPageTextToAiStorage,
} from "~/storage/items";
import ReviewDraft from "./ReviewDraft";
import SubmitAction from "./SubmitAction";

export default function ClipperMain({
  onOpenSettings,
}: {
  onOpenSettings: () => void;
}) {
  const { value: lastDb, set: setLastDb } = useStorageItem(lastUsedDbStorage);
  const { value: provider } = useStorageItem(byokProviderStorage);
  const { value: openAiKey } = useStorageItem(byokOpenaiKeyStorage);
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

  async function saveQuickClip() {
    if (!pageUrl) throw new Error("Could not read the current page URL.");
    return createNotionClip({
      dataSourceId: db,
      title: title.trim(),
      url: pageUrl,
    });
  }

  async function saveEnrichedClip() {
    if (!pageUrl) throw new Error("Could not read the current page URL.");
    return createNotionClip({
      dataSourceId: db,
      title: title.trim(),
      url: pageUrl,
      properties: approvedNotionProperties(flow.screen === "review" ? flow.fields : []),
    });
  }

  async function analyzePage() {
    if (!pageUrl) return;
    dispatchFlow({ type: "analysisStarted" });
    try {
      const fields = await getAiFields(db);
      if (fields.length === 0) {
        dispatchFlow({ type: "analysisReady", fields: [] });
        return;
      }
      if (provider !== "openai" || !openAiKey) {
        dispatchFlow({
          type: "analysisFailed",
          message: "Choose OpenAI and save an API key in Settings before analyzing.",
        });
        return;
      }
      const analysis = await analyzeWithOpenAi({
        apiKey: openAiKey,
        page: {
          title,
          url: pageUrl,
          text: sendFullPageText ? pageText : pageText.slice(0, 1500),
        },
        fields,
      });
      dispatchFlow({ type: "analysisReady", fields: analysis });
    } catch (reason) {
      dispatchFlow({
        type: "analysisFailed",
        message: reason instanceof Error ? reason.message : "Could not analyze this page.",
      });
    }
  }

  async function approveAndSave() {
    dispatchFlow({ type: "approvalStarted" });
    try {
      const result = await saveEnrichedClip();
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
          onBack={() => dispatchFlow({ type: "backToClip" })}
          onApprove={() => void approveAndSave()}
          saving={flow.saving}
          savedPageUrl={flow.savedPageUrl}
        />
        {flow.saveError && <p className="nc-review__error" role="alert">{flow.saveError}</p>}
      </>
    );
  }

  return (
    <div className="nc-main">
      <header className="nc-main__head">
        <div className="nc-main__brand">
          <img className="nc-main__mascot" src={mascotUrl} alt="" />
          <span className="nc-main__name">Notion Web Clipper</span>
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
  );
}
