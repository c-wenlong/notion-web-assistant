// RecipePicker — dropdown sourced from `registry.list()` so the user (and we)
// can visually confirm the recipe plugin registry hydrated correctly. Each
// handler ships with a stable `kind` and a human `summary`.

import { registry } from "~/core/recipes/registry";

export default function RecipePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (kind: string) => void;
}) {
  const handlers = registry.list();

  return (
    <label className="nc-field">
      <span className="nc-field__label">Recipe</span>
      <select
        className="nc-field__select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a step\u2026</option>
        {handlers.map((h) => (
          <option key={h.kind} value={h.kind}>
            {h.summary} \u00b7 {h.kind}
          </option>
        ))}
      </select>
      <span className="nc-field__hint">
        {handlers.length} step types registered locally.
      </span>
    </label>
  );
}
