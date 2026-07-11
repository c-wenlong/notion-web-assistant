// AuthGate — shown by App when no Notion token is saved.
import { mascotUrl } from "~/shared/branding";

///
/// Per spec §6.1 the Options page is the *persistent home* for token paste
/// + first-run onboarding. The popup's job here is only to nudge the user
/// there when they click the toolbar before finishing setup. We open the
/// options page via `chrome.runtime.openOptionsPage()` rather than duplicating
/// the 360px-wide paste form, which would be cramped for the Anthropic /
// Gemini / OAuth keys the user may also want to configure.
///
/// The full token + BYOK form lives at src/entrypoints/options/.

export default function AuthGate() {
  function openSettings() {
    // Browser extensions navigate the user to the registered options page
    // (chrome-extension://<id>/options.html under Chrome MV3). The sibling
    // UI preview app at tools/ui-preview/ mounts the same Options component
    // inline, so we look up `chrome` via globalThis (rather than the bare
    // `chrome` identifier) so this file typechecks in the preview project
    // without pulling in `@types/chrome`. Outside extension contexts the
    // call is a no-op — the preview's tab nav is the user's hint to
    // "switch to the Options tab" if needed.
    const ext = (globalThis as { chrome?: { runtime?: { openOptionsPage?: () => void } } }).chrome;
    try {
      ext?.runtime?.openOptionsPage?.();
    } catch {
      /* no-op in non-extension environments */
    }
  }

  return (
    <div className="nc-auth">
      <div className="nc-auth__brand">
        <img className="nc-auth__mascot" src={mascotUrl} alt="" />
        <h1 className="nc-auth__title">Notion Web Clipper</h1>
        <p className="nc-auth__sub">Finish setup to start clipping.</p>
      </div>

      <p className="nc-auth__help">
        Open Settings to paste your Notion integration secret and pick an AI
        provider. Your token and API keys never leave this device.
      </p>

      <button
        type="button"
        className="nc-auth__submit"
        onClick={openSettings}
      >
        Open Settings
      </button>

      <p className="nc-auth__help">
        Need help? Create an integration at{" "}
        <a
          href="https://www.notion.so/my-integrations"
          target="_blank"
          rel="noreferrer noopener"
        >
          notion.so/my-integrations
        </a>
        , then share at least one database with the integration in Notion.
      </p>
    </div>
  );
}
