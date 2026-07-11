// Auth abstraction per spec §3.2.
// MVP implements InternalTokenAuth; OAuthBackendAuth is a Phase 4 stub.

/** Best-effort identity information we can show in the popup / logs. */
export interface UserHint {
  workspaceId?: string;
  workspaceName?: string;
  workspaceIcon?: string | null;
  botId?: string;
}

/**
 * Swappable Auth interface. The MVP ships `InternalTokenAuth`; the public Chrome
 * Web Store launch switches to `OAuthBackendAuth` (see spec §3.2 + §5.3 Phase 4).
 */
export interface AuthStrategy {
  /** Bearer token for the Notion REST API. Throws if no credentials are set. */
  getNotionToken(): Promise<string>;
  /** Value for the `Notion-Version` header. */
  getNotionVersion(): string;
  /** Best-effort identity / workspace data. Returns {} if unknown. */
  getUserHint(): Promise<UserHint>;
  /** Drop credentials when the user logs out / mode-switches. */
  clear(): Promise<void>;
}
