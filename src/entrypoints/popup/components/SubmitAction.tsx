import { useEffect, useState } from "react";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SubmitAction({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: () => Promise<{ pageUrl: string }>;
}) {
  const [state, setState] = useState<SaveState>("idle");
  const [savedPageUrl, setSavedPageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state !== "saved") return;
    const timeout = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timeout);
  }, [state]);

  async function onClick() {
    setState("saving");
    setError(null);
    try {
      const result = await onSave();
      setSavedPageUrl(result.pageUrl);
      setState("saved");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this clip.");
      setState("error");
    }
  }

  const label =
    state === "saving"
      ? "Saving\u2026"
      : state === "saved"
        ? "Saved \u2713"
        : "Save to Notion";

  return (
    <div className="nc-save">
      {state === "saved" && (
        <div className="nc-save__toast" role="status" aria-live="polite">
          Saved \u2713 {savedPageUrl && <a href={savedPageUrl} target="_blank" rel="noreferrer">Open</a>}
        </div>
      )}
      {state === "error" && <p className="nc-save__error" role="alert">{error}</p>}
      <button
        type="button"
        className="nc-save__btn"
        disabled={disabled || state === "saving"}
        onClick={() => {
          void onClick();
        }}
      >
        {label}
      </button>
    </div>
  );
}
