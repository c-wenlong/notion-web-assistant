// Built-in handler — core:extract per spec §4.2.1.
// MVP shell. The layered extractor (adapter -> CSS selector -> AI) lands in
// core/extraction/* in the next milestone; this handler establishes the
// registry contract, params schema, and result shape.

import { z } from "zod";
import { registry } from "../registry";
import { resolveParams } from "../context";
import type { RecipeContext } from "../types";

const LayersSchema = z
  .array(z.enum(["adapter", "css", "ai"]))
  .nonempty()
  .describe("Priority order. Earlier layers short-circuit later ones.");

const ParamsSchema = z.object({
  propertyName: z.string().min(1).describe("Notion DB property this value targets."),
  layers: LayersSchema,
  cssSelector: z.string().optional().describe("Used by the 'css' layer."),
  prompt: z.string().optional().describe("Sent to the AI provider on the 'ai' layer."),
  adapterHint: z
    .string()
    .optional()
    .describe("E.g. 'arxiv.org/abs/*' to bias the 'adapter' layer."),
});

type Params = z.infer<typeof ParamsSchema>;

interface Result {
  propertyName: string;
  value: string | null;
  source: "adapter" | "css" | "ai" | null;
}

export const extractHandler = {
  kind: "core:extract",
  version: 1,
  summary: "Layered extractor (site adapter -> CSS selector -> AI) for one property.",
  paramsSchema: ParamsSchema,
  async execute(rawParams: Params, ctx: RecipeContext): Promise<Result> {
    ParamsSchema.parse(rawParams); // defense-in-depth Zod parse (spec §10)
    const params = resolveParams(rawParams, ctx);
    // MVP shell returns null. The real implementation in core/extraction/*
    // returns the first non-null value across the priority layers.
    return {
      propertyName: params.propertyName,
      value: null,
      source: null,
    };
  },
};

registry.register(extractHandler);
