// Error envelopes for the recipe runtime (per spec §10 Zod-validation retry style).
// RecipeStepError carries `stepId` so the UI can point at the failing step.
// NotYetImplementedError is used by Phase-N stubs (saveToNotion live write, etc.).

export class RecipeStepError extends Error {
  public readonly stepId?: string;
  public override readonly cause?: unknown;

  constructor(message: string, options?: { stepId?: string; cause?: unknown }) {
    super(message);
    this.name = "RecipeStepError";
    this.stepId = options?.stepId;
    this.cause = options?.cause;
  }
}

export class NotYetImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotYetImplementedError";
  }
}

export class StepReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StepReferenceError";
  }
}
