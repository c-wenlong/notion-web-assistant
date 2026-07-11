// Background service worker entrypoint. WXT auto-generates a manifest entry
// for this. The MVP only needs to (a) populate the recipe registry on boot, and
// (b) host the future Notion-sync / queue-drain / drafts-promotion event hooks.

import { defineBackground } from "wxt/sandbox";

// Side-effect: register all six MVP built-in handlers (per spec §4.2.1).
// Importing the aggregator populates the shared `registry` singleton.
import "~/core/recipes/handlers";

export default defineBackground(() => {
  // The service-worker body intentionally stays empty for the scaffold.
  // Future milestones wire up:
  //   - chrome.alarms for retry-queue backoff (spec §6.4)
  //   - chrome.alarms for drafts promotion (spec §6.5)
  //   - chrome.runtime.onMessage router for popup <-> background calls
});
