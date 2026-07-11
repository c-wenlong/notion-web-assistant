// Hand-rolled `$.steps.{stepId}.{field...}` resolver. Per spec §4.2.5, the
// recipe JSON must be parseable by a hypothetical future mobile app, so we
// avoid pulling in a full JSONPath dependency and keep the addressing DSL
// strictly to what the MVP needs.

import { StepReferenceError } from "./errors";
import type { RecipeContext } from "./types";

const PREFIX = "$.steps.";

/**
 * Resolve a `$.steps.{stepId}.result` or `$.steps.{stepId}.field.subfield` reference.
 * Throws `StepReferenceError` if the reference is malformed or trails off the graph.
 */
export function resolveStepReference(ref: string, ctx: RecipeContext): unknown {
  if (!ref.startsWith(PREFIX)) {
    throw new StepReferenceError(`Unsupported reference (only ${PREFIX}* allowed): ${ref}`);
  }
  const stripped = ref.slice(PREFIX.length);
  const segments = stripped.split(".");
  if (segments.length < 2) {
    throw new StepReferenceError(
      `Malformed reference: ${ref} (expected at least \$.steps.{id}.result)`,
    );
  }
  const [stepId, ...rest] = segments;
  if (!stepId) {
    throw new StepReferenceError(`Empty stepId in reference: ${ref}`);
  }

  let cursor: unknown = ctx.stepResults[stepId];
  if (cursor === undefined) {
    throw new StepReferenceError(
      `Step "${stepId}" has no result yet — make sure it ran before this reference (${ref}).`,
    );
  }
  for (const key of rest) {
    if (cursor === null || typeof cursor !== "object") {
      throw new StepReferenceError(
        `Cannot read "${key}" off a non-object while resolving ${ref}.`,
      );
    }
    cursor = (cursor as Record<string, unknown>)[key];
    if (cursor === undefined) {
      throw new StepReferenceError(
        `Field "${rest.join(".")}" missing on step "${stepId}" (${ref}).`,
      );
    }
  }
  return cursor;
}

/**
 * Deep-walk a params object: any string starting with `$.steps.` is replaced by
 * the resolved value. Pure — does not mutate the input. Returns a structurally
 * identical copy where references have been swapped.
 */
export function resolveParams<T>(params: T, ctx: RecipeContext): T {
  return resolveValue(params, ctx) as T;
}

function resolveValue(value: unknown, ctx: RecipeContext): unknown {
  if (typeof value === "string" && value.startsWith(PREFIX)) {
    return resolveStepReference(value, ctx);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolveValue(v, ctx));
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveValue(v, ctx);
    }
    return out;
  }
  return value;
}
