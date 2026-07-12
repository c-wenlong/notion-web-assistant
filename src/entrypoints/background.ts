import { defineBackground } from "#imports";
import { restrictLocalStorageToTrustedContexts } from "~/core/security/storageAccess";

export default defineBackground(() => {
  void restrictLocalStorageToTrustedContexts(chrome.storage.local);
});
