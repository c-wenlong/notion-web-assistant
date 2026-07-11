// Typed `wxt/storage` items per spec §3.4.
// WXT derives `local:` / `sync:` keys from the prefix on the key string and
// exposes a typed `.getValue()` / `.setValue()` / `.removeValue()` API plus
// a `.watch()` listener. We keep one item per logical area so each subsystem
// can read/write its own slice without serializer conflicts.

import { storage } from "wxt/storage";
import type { UserHint } from "~/core/auth/AuthStrategy";
import type { RecipeRow } from "~/core/recipes/types";

// ── Auth (spec §3.2 + §6.1 onboarding) ─────────────────────────────────────
export const notionTokenStorage = storage.defineItem<string | null>(
  "local:auth.notionToken",
  { fallback: null },
);

export const workspaceHintStorage = storage.defineItem<UserHint | null>(
  "local:auth.workspaceHint",
  { fallback: null },
);

export const authModeStorage = storage.defineItem<"internal" | "oauth">(
  "local:auth.mode",
  { fallback: "internal" },
);

// The popup owns the first-run setup flow. Keeping completion separate from
// the token lets a user review the provider and privacy choices before they
// first land in the clipper.
export const onboardingCompletedStorage = storage.defineItem<boolean>(
  "local:onboarding.completed",
  { fallback: false },
);

// ── Drafts (spec §6.5) ─────────────────────────────────────────────────────
export interface DraftRow {
  id: string;
  createdAt: number;
  recipeId: string | null;
  targetDbId: string;
  properties: Record<string, unknown>;
  status: "pending" | "conflict" | "syncing" | "synced" | "discarded";
  /** Optional Notion file_upload IDs that hadn't completed when offline began. */
  partialUploads?: Array<{ fileUploadId: string; alt: string }>;
}

export const draftsStorage = storage.defineItem<Record<string, DraftRow>>(
  "local:drafts",
  { fallback: {} },
);

export const draftsIndexStorage = storage.defineItem<string[]>(
  "local:draftsIndex",
  { fallback: [] },
);

// ── Failed-save retry queue (spec §6.4) ────────────────────────────────────
export interface QueueItem {
  id: string;
  recipeId: string | null;
  targetDbId: string;
  properties: Record<string, unknown>;
  attempts: number;
  /** Epoch ms; service worker uses for exponential backoff. */
  nextAttemptAt: number;
  /** First error message; shown in the popup's inspector. */
  lastError?: string;
}

export const retryQueueStorage = storage.defineItem<Record<string, QueueItem>>(
  "local:retryQueue",
  { fallback: {} },
);

// ── In-flight recipe cache (source of truth lives in Notion Config DB) ───
export const cachedRecipesStorage = storage.defineItem<Record<string, RecipeRow>>(
  "local:cachedRecipes",
  { fallback: {} },
);

// ── Synced user prefs (spec §3.4 — chrome.storage.sync) ───────────────────
export type Theme = "light" | "dark" | "system";

export const themeStorage = storage.defineItem<Theme>("sync:theme", { fallback: "system" });
export const lastUsedDbStorage = storage.defineItem<string | null>(
  "sync:lastUsedDb",
  { fallback: null },
);
export const byokEnabledStorage = storage.defineItem<boolean>(
  "sync:byokEnabled",
  { fallback: false },
);
// Send the full cleaned page body to the AI provider when extracting.
// Defaults OFF — text is summarized/truncated first (spec §7.2).
export const sendFullPageTextToAiStorage = storage.defineItem<boolean>(
  "sync:ai.sendFullPageText",
  { fallback: false },
);

// ── BYOK AI provider (spec §3.3) ────────────────────────────────────────────
// Stored in local: keys themselves must NOT roam across devices even if the
// "use BYOK" preference does. Provider choice roams via byokEnabledStorage
// (sync). If the user disables byokEnabled globally, the AI router falls back
// to whichever provider Live in `byokProviderStorage` (defaults to 'nano').
export type ByokProvider =
  | "openai"
  | "anthropic"
  | "openrouter"
  | "gemini"
  | "nano";

export const byokProviderStorage = storage.defineItem<ByokProvider>(
  "local:byok.provider",
  { fallback: "nano" },
);

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
