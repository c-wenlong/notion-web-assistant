import type { DraftValue, ReviewField } from "~/core/ai/analyze";

function valueForInput(value: DraftValue): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export default function ReviewDraft({
  title,
  url,
  fields,
  onTitleChange,
  onUrlChange,
  onFieldChange,
  onBack,
  onApprove,
  saving,
  savedPageUrl,
}: {
  title: string;
  url: string;
  fields: ReviewField[];
  onTitleChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onFieldChange: (id: string, value: DraftValue) => void;
  onBack: () => void;
  onApprove: () => void;
  saving: boolean;
  savedPageUrl: string | null;
}) {
  return (
    <div className="nc-review">
      <header className="nc-review__head">
        <button type="button" className="nc-back-btn" onClick={onBack} aria-label="Back to clipper" title="Back">{"\u2190"}</button>
        <div>
          <p className="nc-review__eyebrow">Review</p>
          <h1 className="nc-review__title">Check this clip</h1>
        </div>
      </header>
      <p className="nc-review__intro">Nothing has been saved to Notion yet.</p>

      <div className="nc-review__fields">
        <label className="nc-review__field">
          <span>Name</span>
          <input value={title} onChange={(event) => onTitleChange(event.target.value)} />
        </label>
        <label className="nc-review__field">
          <span>URL</span>
          <input type="url" value={url} onChange={(event) => onUrlChange(event.target.value)} />
        </label>
        {fields.map((field) => (
          <ReviewFieldControl key={field.id} field={field} onChange={onFieldChange} />
        ))}
      </div>

      <footer className="nc-review__foot">
        <button type="button" className="nc-review__secondary" onClick={onBack}>Back</button>
        {savedPageUrl ? (
          <a className="nc-review__primary" href={savedPageUrl} target="_blank" rel="noreferrer">Saved - open in Notion</a>
        ) : (
          <button type="button" className="nc-review__primary" onClick={onApprove} disabled={saving || !title.trim() || !url.trim()}>
            {saving ? "Saving..." : "Approve & save"}
          </button>
        )}
      </footer>
    </div>
  );
}

function ReviewFieldControl({ field, onChange }: { field: ReviewField; onChange: (id: string, value: DraftValue) => void }) {
  if (field.type === "checkbox") {
    return (
      <label className="nc-review__toggle">
        <span>{field.name}</span>
        <input type="checkbox" checked={field.value === true} onChange={(event) => onChange(field.id, event.target.checked)} />
      </label>
    );
  }
  if (field.type === "select") {
    if (field.options.length === 0) {
      return (
        <label className="nc-review__field">
          <span>{field.name}</span>
          {field.description && <em className="nc-review__hint">{field.description}</em>}
          <input
            value={valueForInput(field.value)}
            placeholder="New Notion option"
            onChange={(event) => onChange(field.id, event.target.value || null)}
          />
        </label>
      );
    }
    return (
      <label className="nc-review__field">
        <span>{field.name}</span>
        {field.description && <em className="nc-review__hint">{field.description}</em>}
        <select value={valueForInput(field.value)} onChange={(event) => onChange(field.id, event.target.value || null)}>
          <option value="">No value</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === "multi_select") {
    return (
      <fieldset className="nc-review__multi">
        <legend>{field.name}</legend>
        {field.description && <em className="nc-review__hint">{field.description}</em>}
        {field.options.map((option) => {
          const selected = Array.isArray(field.value) && field.value.includes(option);
          return (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected}
                onChange={(event) => {
                  const current = Array.isArray(field.value) ? field.value : [];
                  onChange(field.id, event.target.checked ? [...current, option] : current.filter((item) => item !== option));
                }}
              />
              {option}
            </label>
          );
        })}
      </fieldset>
    );
  }
  return (
    <label className="nc-review__field">
      <span>{field.name}</span>
      {field.description && <em className="nc-review__hint">{field.description}</em>}
      <input
        type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
        value={valueForInput(field.value)}
        onChange={(event) => {
          const value = event.target.value;
          onChange(field.id, field.type === "number" ? (value === "" ? null : Number(value)) : (value || null));
        }}
      />
    </label>
  );
}
