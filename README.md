# Notion Web Clipper

<p align="center">
  <img src="src/assets/sprites/cheering.png" width="72" alt="Notion Web Clipper mascot cheering">
  <img src="src/assets/sprites/walking.png" width="72" alt="Notion Web Clipper mascot walking">
  <img src="src/assets/sprites/running.png" width="72" alt="Notion Web Clipper mascot running">
  <img src="src/assets/sprites/sitting.png" width="72" alt="Notion Web Clipper mascot sitting">
  <img src="src/assets/sprites/standing.png" width="72" alt="Notion Web Clipper mascot standing">
</p>

<p align="center">Save useful pages to the Notion databases you already use.</p>

<p align="center">
  <a href="https://github.com/c-wenlong/notion-web-assistant/actions/workflows/ci.yml"><img src="https://github.com/c-wenlong/notion-web-assistant/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI status"></a>
  <a href="https://github.com/c-wenlong/notion-web-assistant/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-2f6feb.svg" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/version-1.0.1-2f6feb.svg" alt="Version 1.0.1">
  <img src="https://img.shields.io/badge/status-v1.0-16803c.svg" alt="Version 1.0">
</p>

**Notion Web Clipper** is a Manifest V3 Chrome extension for capturing the current page in a Notion database. It can either save the essentials immediately or prepare additional database fields with AI before you approve the result.

## What it does

- Lists the Notion databases shared with your integration.
- Saves the page title to Notion's title property and the current page URL to a URL property.
- Uses the page URL as a duplicate key and lets you cancel or overwrite a matching row before writing.
- Creates a `URL` property when the selected database does not have one.
- Offers two capture paths: `Quick Clip` for title and URL only, and `Smart Clip` for an AI-prepared, editable review before saving.
- Cleans page content locally with Defuddle by default, with an option to use the original page text instead.
- Lets you connect and verify your Notion integration and AI key from the extension popup.
- Stores credentials locally and offers light, dark, and system appearance modes.

## Quick Start

### Requirements

- Google Chrome or another Chromium browser with unpacked extensions enabled.
- Node.js 22 or later.
- pnpm 11.7.0 or later.
- A Notion internal integration with access to at least one database.

### Install and build

```bash
git clone https://github.com/c-wenlong/notion-web-assistant.git
cd notion-web-assistant
corepack enable
pnpm install
pnpm build
```

### Load the extension in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select `.output/chrome-mv3` from this repository.
5. Pin **Notion Web Clipper** and open it on a normal web page.

Run `pnpm build` again after source changes, then select **Reload** for the extension on `chrome://extensions`.

## Connect Notion

1. Create an internal integration in [Notion's integrations page](https://www.notion.so/my-integrations).
2. In Notion, share each destination database with that integration.
3. Open the extension, choose **Settings**, then open **Notion connection**.
4. Paste the integration secret and run the connection check.
5. Confirm that the databases you shared appear in the list.

The selected database needs a title property. Notion Web Clipper uses it for the page name. If the database has no URL property, the extension adds a `URL` property before saving; the integration therefore needs permission to update the database schema.

## Capture Modes

| Mode | What happens |
| --- | --- |
| **Quick Clip** | Immediately creates a row containing only the page title and URL. No page text is sent to an AI provider. |
| **Smart Clip** | Reads the selected database's compatible properties, asks the configured AI provider to prepare values, shows an editable review, and saves only after you approve. |

Smart Clip runs through the provider selected in Settings: OpenAI, Anthropic, Google Gemini, or OpenRouter. OpenRouter uses its `openrouter/free` model router, so there is no model charge, but an OpenRouter API key is still required and its free models can have lower limits or availability.

## Privacy and Security

- The Notion integration secret and AI keys are stored in `chrome.storage.local` and restricted to trusted extension contexts. They are not sent to a Notion Web Clipper server because v1 has no backend.
- The extension talks directly to Notion and, when Smart Clip is used, the configured AI provider.
- Smart Clip sends up to 60,000 characters of extracted page text, plus the selected field names and options, to the selected AI provider after the user explicitly starts Smart Clip.
- Defuddle extraction runs locally with its network fallbacks disabled. It can be turned off under **Content extraction** in Settings.
- Do not commit real secrets. Local `.env` files, signing keys, and build output are ignored by Git.
- OAuth is planned for a future release and is not available in v1.

See [SECURITY.md](SECURITY.md) for reporting guidance.

## Development

```bash
# Run all tests, type checks, and production builds.
pnpm verify

# Build the Chrome extension only.
pnpm build

# Start WXT's development workflow.
pnpm dev

# Build the standalone UI preview.
pnpm --dir tools/ui-preview --ignore-workspace build
```

The codebase uses WXT, React 18, TypeScript, and pnpm. The popup lives in `src/entrypoints`; Notion and AI integrations live in `src/core`; persistent state uses `wxt/utils/storage` in `src/storage`.

## CI and Delivery

The [CI workflow](.github/workflows/ci.yml) runs on every push, pull request, and manual dispatch. It installs both frozen lockfiles, runs the full dependency audit and `pnpm verify`, then uploads `.output/chrome-mv3` as a 14-day GitHub Actions artifact.

There is no automatic Chrome Web Store deployment yet. For unpacked testing, build locally or use the CI artifact and load the resulting `chrome-mv3` directory as an unpacked extension. A future release pipeline can add signed ZIP generation and Chrome Web Store publishing once OAuth and store readiness are in place.

## Versioning and Releases

This repository follows semantic versioning. The current release is **1.0.1**. Release notes live in [CHANGELOG.md](CHANGELOG.md). The package version is also used by the generated Chrome extension manifest.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the local workflow and quality checks. Please keep changes focused, add or update tests for behavioral changes, and make sure `pnpm verify` passes before opening a pull request.

## License

Distributed under the [MIT License](LICENSE).
