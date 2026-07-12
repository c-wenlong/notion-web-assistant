import type { AuthStrategy } from "./AuthStrategy";
import { InternalTokenAuth } from "./InternalTokenAuth";

export { InternalTokenAuth } from "./InternalTokenAuth";
export type { AuthStrategy, UserHint } from "./AuthStrategy";

/** Return the local integration-token strategy used by the extension. */
export function getAuthStrategy(): AuthStrategy {
  return new InternalTokenAuth();
}
