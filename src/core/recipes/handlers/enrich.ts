// Built-in handler — core:enrich per spec §4.2.1 and §4.3.
// Calls one of the public metadata APIs (Crossref, OpenAlex, Open Library, arXiv,
// GitHub) using an identifier from a prior step. MVP shell: real fetches land in
// core/enrichment/* on the next milestone.

import { z } from "zod";
import { registry } from "../registry";
import { resolveParams } from "../context";
import type { RecipeContext } from "../types";

const ParamsSchema = z.object({
  source: z.enum(["crossref", "openalex", "openlibrary", "arxiv", "github"]),
  identifier: z
    .string()
    .min(1)
    .describe("Identifier (DOI, ISBN, arXiv ID, or URL) or a $.steps.… reference."),
  fields: z.array(z.string()).optional().describe("Subset of fields to return."),
  outputProperty: z
    .string()
    .min(1)
    .describe("Notion DB property the merged enrichment is parked under."),
});

type Params = z.infer<typeof ParamsSchema>;

interface Result {
  source: Params["source"];
  identifier: string;
  enrichment: Record<string, unknown>;
}

export const enrichHandler = {
  kind: "core:enrich",
  version: 1,
  summary: "Look up metadata on Crossref / OpenAlex / Open Library / arXiv / GitHub.",
  paramsSchema: ParamsSchema,
  async execute(rawParams: Params, ctx: RecipeContext): Promise<Result> {
    ParamsSchema.parse(rawParams); // defense-in-depth Zod parse (spec §10)
    const params = resolveParams(rawParams, ctx);
    return {
      source: params.source,
      identifier: params.identifier,
      enrichment: {},
    };
  },
};

registry.register(enrichHandler);
