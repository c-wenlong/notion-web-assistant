# UI Preview

Standalone Vite dev loop for the popup UI. Imports the real popup React
components from `../../src/entrypoints/popup/...` and feeds them mocked
storage + page/selection fixtures so you can iterate on layouts in a normal
browser tab — no Chrome extension reload required.

Runs at **http://127.0.0.1:5174/**.

## Setup

From this directory:

```bash
pnpm install
```

(The parent project does not need any awareness of this subdir; it's an
independent node project with its own lockfile.)

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server on port 5174. Hot reloads the popup components live as you edit them in either project. Open **http://127.0.0.1:5174/** in your browser. |
| `pnpm build` | Production-style bundle (sanity check that everything compiles into a single HTML). |
| `pnpm preview` | Serves the production build locally. |
| `pnpm compile` | `tsc --noEmit` — typechecks only. |

Cmd/Ctrl-R re-seeds the default fixture (arXiv) and signs in with a fake
token. Browser refresh is suppressed so the in-memory shim survives.

## What this app mocks

- `wxt/utils/storage` is aliased to `src/shims/wxt-storage.ts` — an in-memory polyfill that drops the popup's `useStorageItem` calls into a per-tab Map. Cross-context tab sync is intentionally absent (single tab).
- `notionTokenStorage`, `lastUsedDbStorage`, etc. all write through the shim, so the popup's UI behaves like a connected session.
- Page URL + selection come from preview-only storage items defined in `src/fixtures/fixture-storage.ts`. They mimic the popup's active-tab metadata flow.

## Layout

The browser tab is split:

- **Left side panel (`PageControls`)** — drives the mocks. Buttons to sign in / sign out (writes/removes the fake notion token), a page-fixture picker (arXiv, Amazon book, HN thread, personal page), and free-form page-URL + selection inputs.
- **Right pane** — the real popup React tree wrapped in a faux-Chrome chrome strip.

## Important

This project is for **UI iteration only**. It does not call Notion or extension-vendor APIs. Edit
`src/entrypoints/popup/**` in the parent project; the preview's HMR picks it
up immediately.
