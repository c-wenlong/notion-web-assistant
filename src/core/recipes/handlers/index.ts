// Side-effect aggregator — importing this module registers all six MVP built-in
// handlers in spec §4.2.1. Used by `import "~/core/recipes/handlers"` in the
// background service worker so the registry is populated before any recipe runs.

import "./setField";
import "./extract";
import "./enrich";
import "./queryNotion";
import "./saveToNotion";
import "./chainRecipe";

/**
 * The six kinds that ship in MVP, in registration order. Mirrors spec §4.2.1
 * table — kept here so other modules can reference the canonical list without
 * importing each handler file separately.
 */
export const CORE_HANDLER_KINDS = [
  "core:setField",
  "core:extract",
  "core:enrich",
  "core:queryNotion",
  "core:saveToNotion",
  "core:chainRecipe",
] as const;

export type CoreHandlerKind = (typeof CORE_HANDLER_KINDS)[number];
