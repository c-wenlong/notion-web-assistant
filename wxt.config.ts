// https://wxt.dev/api/config.html
import { defineConfig } from 'wxt';

export default defineConfig({
  // Source code lives under `src/`. WXT auto-discovers entrypoints at
  // `${srcDir}/entrypoints/` (i.e. `src/entrypoints/`). Don't override
  // `entrypointsDir` — concatenating it with `srcDir` causes a path-doubling
  // bug at wxt prepare time.
  srcDir: 'src',
  // Pin Notion API version per spec §3.2 — header injected by the API client.
  // Manifest V3 is the default in WXT.
  manifest: ({ browser }) => ({
    // `activeTab` grants the popup access to the current page only after the
    // user opens it, which is enough to read title and URL via the content script.
    permissions: ['storage', 'activeTab'],
    host_permissions: [
      'https://api.notion.com/*',
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://openrouter.ai/api/*',
      'https://generativelanguage.googleapis.com/*',
      'https://api.crossref.org/*',
      'https://api.openalex.org/*',
      'https://openlibrary.org/*',
      'https://export.arxiv.org/*',
      'https://api.github.com/*',
    ],
    // queried runtime; `optional_host_permissions` lets users grant per-site.
    optional_permissions: browser === 'firefox' ? [] : [],
  }),
});
