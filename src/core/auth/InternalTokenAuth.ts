// InternalTokenAuth — MVP auth implementation per spec §3.2 and §6.1.
// Reads the Notion integration secret from chrome.storage.local.
// Throws a friendly error if the token isn't set yet (onboarding not complete).

import { notionTokenStorage, workspaceHintStorage } from "~/storage/items";
import { NOTION_API_VERSION } from "~/shared/constants";
import type { AuthStrategy, UserHint } from "./AuthStrategy";

export class InternalTokenAuth implements AuthStrategy {
  /** Read the pasted integration token. */
  async getNotionToken(): Promise<string> {
    const token = await notionTokenStorage.getValue();
    if (!token) {
      throw new Error(
        "Notion integration token is not set. Open the extension Options page and paste your integration secret.",
      );
    }
    return token;
  }

  /** Always pin to the latest known Notion API version. */
  getNotionVersion(): string {
    return NOTION_API_VERSION;
  }

  /** Cached hint set during onboarding after the first successful API call. */
  async getUserHint(): Promise<UserHint> {
    return (await workspaceHintStorage.getValue()) ?? {};
  }

  /** Used by the Options page on logout. */
  async clear(): Promise<void> {
    await notionTokenStorage.removeValue();
    await workspaceHintStorage.removeValue();
  }
}
