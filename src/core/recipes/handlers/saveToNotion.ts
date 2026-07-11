// Built-in handler — core:saveToNotion per spec §4.2.1.
// Writes the assembled row to the target Notion DB. MVP shell: dry-run succeeds
// with a stub page id; live write throws NotYetImplementedError so the UI shows
// the user a clear "coming soon" surface (real implementation lands in
// core/notion/pages.ts).

import { z } from "zod";
import { registry } from "../registry";
import { NotYetImplementedError } from "../errors";
import type { RecipeContext } from "../types";

const ParamsSchema = z.object({
  targetDbId: z.string().min(1),
  properties: z
    .record(z.unknown())
    .describe("Notion property map. String values may be $.steps.{id}.… references."),
});

type Params = z.infer<typeof ParamsSchema>;

interface Result {
  pageId: string;
  url: string;
}

export const saveToNotionHandler = {
  kind: "core:saveToNotion",
  version: 1,
  summary: "Write the assembled row into the target Notion DB.",
  paramsSchema: ParamsSchema,
  async execute(rawParams: Params, ctx: RecipeContext): Promise<Result> {
    ParamsSchema.parse(rawParams); // validate even though live write is a stub
    if (ctx.dryRun) {
      // Dry-runs never touch Notion; return a deterministic stub so the
      // Recipe Builder can preview the row without committing.
      return { pageId: "dry-run", url: "" };
    }
    // Real implementation lands in core/notion/pages.ts on the next milestone.
    throw new NotYetImplementedError(
      "core:saveToNotion live execution lands in Phase 2 (core/notion/pages.ts). " +
        "Dry-run returns succeed; live saves surface this message in the popup.",
    );
  },
};

registry.register(saveToNotionHandler);
