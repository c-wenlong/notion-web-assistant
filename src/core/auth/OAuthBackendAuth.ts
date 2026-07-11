// OAuthBackendAuth — stub for the Phase 4 Chrome Web Store launch (spec §3.2, §5.3).
// The MVP ships without a backend, so this class throws NotYetImplementedError
// on every call. The factory only constructs this when the user has explicitly
// opted into OAuth mode AND a backend URL has been configured.

import { NotYetImplementedError } from "~/core/recipes/errors";
import { NOTION_API_VERSION } from "~/shared/constants";
import type { AuthStrategy, UserHint } from "./AuthStrategy";

export class OAuthBackendAuth implements AuthStrategy {
  getNotionToken(): Promise<string> {
    return Promise.reject(
      new NotYetImplementedError(
        "OAuthBackendAuth is reserved for Phase 4 (public Chrome Web Store launch). " +
          "Stay on InternalTokenAuth for the MVP — see spec §3.2.",
      ),
    );
  }

  getNotionVersion(): string {
    return NOTION_API_VERSION;
  }

  getUserHint(): Promise<UserHint> {
    return Promise.reject(
      new NotYetImplementedError("OAuthBackendAuth.getUserHint not implemented."),
    );
  }

  async clear(): Promise<void> {
    // No client-side credentials to clear in Phase 4 (the bot token lives server-side).
  }
}
