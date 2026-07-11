// RecipeStepHandler registry per spec §4.2.1.
// The type set is OPEN — built-in handlers self-register in their own files;
// future contributors can drop in extra files under src/core/recipes/handlers/.
//
// Each RecipeStepHandler carries:
//   - kind:   stable string identifier, e.g. "core:extract"
//   - version: bump on breaking params changes; the Recipe document pins version
//   - summary: human label for the Recipe Builder dropdown
//   - paramsSchema: Zod schema that validates the step's params object
//   - execute:   the actual work. Receives the validated params + RecipeContext.

import type { z } from "zod";

export interface RecipeStepHandler<TParams = unknown, TResult = unknown> {
  readonly kind: string;
  readonly version: number;
  readonly summary: string;
  readonly paramsSchema: z.ZodType<TParams>;
  execute(params: TParams, ctx: import("./types").RecipeContext): Promise<TResult>;
}

class RegistryImpl {
  private readonly handlers = new Map<string, RecipeStepHandler<unknown, unknown>>();

  /** Self-registration is done at module load by each handler file. */
  register<TParams, TResult>(handler: RecipeStepHandler<TParams, TResult>): void {
    if (this.handlers.has(handler.kind)) {
      throw new Error(
        `Duplicate recipe handler registered for kind "${handler.kind}". ` +
          `Check the imports in src/core/recipes/handlers/ — only one declaration is allowed.`,
      );
    }
    this.handlers.set(handler.kind, handler as unknown as RecipeStepHandler<unknown, unknown>);
  }

  /** Look up a handler by kind; `undefined` if not installed locally. */
  get(kind: string): RecipeStepHandler<unknown, unknown> | undefined {
    return this.handlers.get(kind);
  }

  has(kind: string): boolean {
    return this.handlers.has(kind);
  }

  /** All locally-registered handler kinds — used to filter the Builder dropdown. */
  list(): readonly RecipeStepHandler<unknown, unknown>[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Compare a Recipe row's `requiredHandlers` against the locally installed set.
   * Returns the missing kinds so the UI can render:
   *   "3 of 4 step types installed locally. Missing: 'community:crossref'."
   * See spec §4.2.2 portability rule.
   */
  missingHandlers(requiredHandlers: readonly string[]): string[] {
    return requiredHandlers.filter((k) => !this.handlers.has(k));
  }
}

/** Single shared registry — created once, imported everywhere. */
export const registry = new RegistryImpl();
