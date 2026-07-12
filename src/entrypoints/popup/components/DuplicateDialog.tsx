export default function DuplicateDialog({
  pageUrl,
  overwriting,
  error,
  updatedPageUrl,
  actionLabel,
  description,
  onCancel,
  onOverwrite,
}: {
  pageUrl: string;
  overwriting: boolean;
  error: string | null;
  updatedPageUrl: string | null;
  actionLabel: string;
  description: string;
  onCancel: () => void;
  onOverwrite: () => void;
}) {
  return (
    <div className="nc-duplicate" role="presentation">
      <div className="nc-duplicate__dialog" role="dialog" aria-modal="true" aria-labelledby="duplicate-title">
        {updatedPageUrl ? (
          <>
            <p className="nc-duplicate__eyebrow">Updated</p>
            <h2 id="duplicate-title">Existing clip replaced</h2>
            <a className="nc-duplicate__primary" href={updatedPageUrl} target="_blank" rel="noreferrer">Open in Notion</a>
            <button type="button" className="nc-duplicate__secondary" onClick={onCancel}>Done</button>
          </>
        ) : (
          <>
            <p className="nc-duplicate__eyebrow">Duplicate found</p>
            <h2 id="duplicate-title">This URL is already clipped</h2>
            <p>{description}</p>
            <a className="nc-duplicate__existing" href={pageUrl} target="_blank" rel="noreferrer">Open existing row</a>
            {error && <p className="nc-duplicate__error" role="alert">{error}</p>}
            <div className="nc-duplicate__actions">
              <button type="button" className="nc-duplicate__secondary" onClick={onCancel} disabled={overwriting}>Cancel</button>
              <button type="button" className="nc-duplicate__primary" onClick={onOverwrite} disabled={overwriting}>
                {overwriting ? "Overwriting..." : actionLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
