// Built-in handler — core:queryNotion per spec §4.2.1 and §4.3.
// Reads from the target Notion DB (typically duplicate detection before a save).
// MVP shell: real queries land in core/queries/findDuplicate.ts on the next
// milestone.

import { z } from "zod";
import { registry } from "../registry";
import { resolveParams } from "../context";
import type { RecipeContext } from "../types";

const ParamsSchema = z.object({
  targetDbId: z.string().min(1).describe("Notion DB ID (or Data Source ID post-2025-09-03)."),
  matchField: z
    .string()
    .min(1)
    .describe("Property name to match on, e.g. 'URL', 'DOI', 'ISBN'."),
  matchValueRef: z
    .string()
    .min(1)
    .describe("$.steps.{id}.result.path reference resolving to the value to match."),
  onFound: z
    .enum(["abort", "update", "ignore"])
    .default("abort")
    .describe("What to do if a matching row already exists."),
});

type Params = z.infer<typeof ParamsSchema>;

interface Result {
  found: boolean;
  matchedPageId?: string;
  action: Params["onFound"];
}

export const queryNotionHandler = {
  kind: "core:queryNotion",
  version: 1,
  summary: "Lookup on the user's Notion DBs (typically duplicate detection).",
  paramsSchema: ParamsSchema,
  async execute(rawParams: Params, ctx: RecipeContext): Promise<Result> {
    ParamsSchema.parse(rawParams); // defense-in-depth Zod parse (spec §10)
    const params = resolveParams(rawParams, ctx);
    // MVP shell — real query lands in core/queries/findDuplicate.ts.
    return { found: false, action: params.onFound };
  },
};

registry.register(queryNotionHandler);
