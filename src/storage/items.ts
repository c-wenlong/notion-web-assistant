import { storage } from "wxt/utils/storage";
import type { UserHint } from "~/core/auth/AuthStrategy";

// ── Auth (spec §3.2 + §6.1 onboarding) ─────────────────────────────────────
export const notionTokenStorage = storage.defineItem<string | null>(
  "local:auth.notionToken",
  { fallback: null },
);

export const workspaceHintStorage = storage.defineItem<UserHint | null>(
  "local:auth.workspaceHint",
  { fallback: null },
);

// The popup owns the first-run setup flow. Keeping completion separate from
// the token lets a user review provider choices before they first land in the
// clipper.
export const onboardingCompletedStorage = storage.defineItem<boolean>(
  "local:onboarding.completed",
  { fallback: false },
);

// ── Synced user preferences ─────────────────────────────────────────────────
export type Theme = "light" | "dark" | "system";

export const themeStorage = storage.defineItem<Theme>("sync:theme", { fallback: "system" });
export const defuddleEnabledStorage = storage.defineItem<boolean>(
  "sync:contentExtraction.defuddleEnabled",
  { fallback: true },
);
export const lastUsedDbStorage = storage.defineItem<string | null>(
  "sync:lastUsedDb",
  { fallback: null },
);
// ── BYOK AI provider (spec §3.3) ────────────────────────────────────────────
// Provider keys never roam across devices.
export type ByokProvider =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "gemini";

// Nano was shown in early builds but never had a local-model runtime.
// Retain its legacy value only long enough to map existing installations to
// the supported OpenAI default.
export type StoredByokProvider = ByokProvider | "nano";

export const byokProviderStorage = storage.defineItem<StoredByokProvider>(
  "local:byok.provider",
  { fallback: "openai" },
);

export function resolveByokProvider(value: StoredByokProvider | undefined): ByokProvider {
  return value === "nano" ? "openai" : value ?? "openai";
}

export const byokOpenaiKeyStorage = storage.defineItem<string | null>(
  "local:byok.openaiKey",
  { fallback: null },
);
export const byokAnthropicKeyStorage = storage.defineItem<string | null>(
  "local:byok.anthropicKey",
  { fallback: null },
);
export const byokOpenRouterKeyStorage = storage.defineItem<string | null>(
  "local:byok.openRouterKey",
  { fallback: null },
);
export const byokGeminiKeyStorage = storage.defineItem<string | null>(
  "local:byok.geminiKey",
  { fallback: null },
);
