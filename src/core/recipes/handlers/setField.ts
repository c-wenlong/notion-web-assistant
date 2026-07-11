// Built-in handler — core:setField per spec §4.2.1.
// Assigns a static or AI-extracted value to a single Notion property. The value
// may be a literal or a $.steps.{id}.result JSONPath resolved against the current
// RecipeContext (see ../context.ts).

import { z } from "zod";
import { registry } from "../registry";
import { resolveParams } from "../context";
import type { RecipeContext } from "../types";

const ParamsSchema = z.object({
  propertyName: z.string().min(1).describe("Notion DB property name (e.g. 'Title', 'URL')."),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()])
    .describe("Literal value, or a `$.steps.{stepId}.result` reference."),
});

type Params = z.infer<typeof ParamsSchema>;

interface Result {
  propertyName: string;
  value: Params["value"];
}

export const setFieldHandler = {
  kind: "core:setField",
  version: 1,
  summary: "Assign a literal or step-derived value to a Notion property.",
  paramsSchema: ParamsSchema,
  async execute(rawParams: Params, ctx: RecipeContext): Promise<Result> {
    // Defense-in-depth Zod parse: spec §10 mandates schema validation before execute.
    // The Recipe Runner (Phase 2) calls paramsSchema.parse() at the chokepoint; this
    // is the second line of defense for any caller that skips the Runner.
    ParamsSchema.parse(rawParams);
    // resolveParams walks JSONPath strings; throws StepReferenceError on bad refs.
    const params = resolveParams(rawParams, ctx);
    return { propertyName: params.propertyName, value: params.value };
  },
};

registry.register(setFieldHandler);
