/** Best-effort identity information we can show in the popup / logs. */
export interface UserHint {
  workspaceId?: string;
  workspaceName?: string;
  workspaceIcon?: string | null;
  botId?: string;
}

/** Interface implemented by the extension's Notion credential provider. */
export interface AuthStrategy {
  /** Bearer token for the Notion REST API. Throws if no credentials are set. */
  getNotionToken(): Promise<string>;
  /** Value for the `Notion-Version` header. */
  getNotionVersion(): string;
  /** Best-effort identity / workspace data. Returns {} if unknown. */
  getUserHint(): Promise<UserHint>;
  /** Drop locally stored credentials when the user disconnects. */
  clear(): Promise<void>;
}
