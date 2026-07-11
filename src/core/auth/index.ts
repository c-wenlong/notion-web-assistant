// Auth factory with cached strategy. MVP picks InternalTokenAuth; Phase 4 flips to
// OAuthBackendAuth when the user explicitly switches auth modes.

import { authModeStorage } from "~/storage/items";
import type { AuthStrategy } from "./AuthStrategy";
import { InternalTokenAuth } from "./InternalTokenAuth";
import { OAuthBackendAuth } from "./OAuthBackendAuth";

export { InternalTokenAuth } from "./InternalTokenAuth";
export { OAuthBackendAuth } from "./OAuthBackendAuth";
export type { AuthStrategy, UserHint } from "./AuthStrategy";

let cached: AuthStrategy | null = null;

/** Return the currently-active auth strategy, instantiating on first call. */
export async function getAuthStrategy(): Promise<AuthStrategy> {
  if (cached) return cached;
  const mode = await authModeStorage.getValue();
  cached = mode === "oauth" ? new OAuthBackendAuth() : new InternalTokenAuth();
  return cached;
}

/**
 * Reset the cached strategy. Call after the user toggles `authModeStorage`
 * or clears credentials, so the next `getAuthStrategy()` rebuilds.
 */
export function resetAuthStrategy(): void {
  cached = null;
}
