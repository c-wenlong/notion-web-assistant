// Recipe document types — mirror spec §4.2.2. Zod schemas run on load to
// reject malformed Config DB rows before they enter the registry.

import { z } from "zod";
import { CURRENT_RECIPE_SCHEMA_VERSION } from "~/shared/constants";

/** Triggers a recipe can fire on (spec §4.2.3). */
export const RECIPE_TRIGGERS = ["page", "selection", "notionQuery", "notionPage"] as const;
export type RecipeTrigger = (typeof RECIPE_TRIGGERS)[number];

export interface RecipeStep {
  /** Stable within a recipe; used as the path key in `$.steps.{stepId}.…` refs. */
  stepId: string;
  /** Must match a registered `RecipeStepHandler.kind`. */
  kind: string;
  /** Pin for which handler version this step was authored against. */
  version: number;
  /** Validated by the handler's `paramsSchema` on load + on save. */
  params: unknown;
}

export interface RecipeRow {
  /** Notion-native row id (stable across the Config DB). */
  id: string;
  name: string;
  description?: string;
  targetDbId: string;
  triggers: RecipeTrigger[];
  /** Derived from `steps[*].kind`; see spec §4.2.2 portability rule. */
  requiredHandlers: string[];
  steps: RecipeStep[];
  enabled: boolean;
  /** Pin the recipe *document* shape, independent of step kinds. */
  schemaVersion: number;
}

/** Runtime context handed to each handler.execute() call. */
export interface RecipeContext {
  pageUrl: string;
  selection?: string;
  /** Keyed by `stepId`; each value is the structured output of that step. */
  stepResults: Record<string, unknown>;
  /** True if this is a dry-run from the Recipe Builder; live writes must short-circuit. */
  dryRun: boolean;
  /** Out-of-band attachments (file_upload IDs, draft metadata, etc.), keyed by stepId. */
  artifacts: Record<string, unknown>;
}

/* ── Zod schemas for load-time validation ────────────────────────────────── */

export const RecipeStepSchema = z.object({
  stepId: z.string().min(1),
  kind: z.string().min(1),
  version: z.number().int().nonnegative(),
  params: z.unknown(),
});

export const RecipeTriggerSchema = z.enum(RECIPE_TRIGGERS);

export const RecipeRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  targetDbId: z.string(),
  triggers: z.array(RecipeTriggerSchema),
  requiredHandlers: z.array(z.string().min(1)),
  steps: z.array(RecipeStepSchema),
  enabled: z.boolean(),
  schemaVersion: z.number().int().nonnegative(),
});

/** Compare against CURRENT_RECIPE_SCHEMA_VERSION on load — see spec §4.2.2. */
export function isRecipeSchemaSupported(row: RecipeRow): boolean {
  return row.schemaVersion === CURRENT_RECIPE_SCHEMA_VERSION;
}
