interface LocalStorageAccessController {
  setAccessLevel?: (details: { accessLevel: "TRUSTED_CONTEXTS" }) => Promise<void>;
}

/** Keep extension credentials unavailable to content scripts. */
export function restrictLocalStorageToTrustedContexts(
  storage: LocalStorageAccessController,
): Promise<void> | undefined {
  return storage.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" });
}
