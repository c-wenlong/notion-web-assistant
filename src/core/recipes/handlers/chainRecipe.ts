// Built-in handler — core:chainRecipe per spec §4.2.1.
// Calls another recipe as a sub-step. MVP shell: real executor (runRecipe) lands
// in core/recipes/runner.ts (Phase 2). This file establishes the registry contract.

import { z } from "zod";
import { registry } from "../registry";
import type { RecipeContext } from "../types";

const ParamsSchema = z.object({
  recipeId: z.string().min(1).describe("Notion row id of the recipe to run."),
  passThrough: z
    .boolean()
    .default(true)
    .describe("If true, the sub-recipe's stepResults are merged into the parent ctx."),
});

type Params = z.infer<typeof ParamsSchema>;

interface Result {
  recipeId: string;
  result: unknown;
}

export const chainRecipeHandler = {
  kind: "core:chainRecipe",
  version: 1,
  summary: "Run another recipe as a sub-step (composition).",
  paramsSchema: ParamsSchema,
  async execute(rawParams: Params, _ctx: RecipeContext): Promise<Result> {
    ParamsSchema.parse(rawParams); // defense-in-depth Zod parse (spec §10)
    return { recipeId: rawParams.recipeId, result: null };
  },
};

registry.register(chainRecipeHandler);
