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
  manifest: () => ({
    name: 'Notion Web Clipper',
    icons: {
      16: 'icons/16.png',
      32: 'icons/32.png',
      48: 'icons/48.png',
      128: 'icons/128.png',
    },
    // `activeTab` grants temporary access only after the user opens the popup.
    // The popup injects the metadata reader at that point instead of running on
    // every page in the background.
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: [
      'https://api.notion.com/*',
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://openrouter.ai/api/*',
      'https://generativelanguage.googleapis.com/*',
    ],
  }),
});
