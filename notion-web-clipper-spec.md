# Notion Web Clipper — Product Spec

> **Status:** Draft v2 — section §9 open questions resolved after round-4 interview + plugin-registry + image + drafts design.
> **Product name:** Notion Web Clipper.

---

## 1. One-paragraph summary

A Manifest V3 browser extension that replaces today's "URL + name" Notion clippers with three coordinated capabilities:

1. **Intelligent transformation** — extract any page into user-defined Notion DB rows, using a layered mapping system (CSS selectors → AI extraction → user-authored rules).
2. **Workflow automation** — user-defined recipes (named, multi-step, one-click) for repetitive flows such as "Save paper with DOI enrichment" or "Track company across the web".
3. **Background actions and reads** — pre-save enrichment (Crossref, OpenAlex, Open Library, etc.) and post-save queries (duplicate detection, related-item summaries, bulk cleanup) against the user's existing Notion DBs.

Target distribution: eventually public on the Chrome Web Store; MVP ships as a fully client-side, unpacked extension with internal-integration token auth.

---

## 2. User-identified problems (verbatim distilled)

| # | Pain today | Proposed capability |
|---|---|---|
| 1a | Most clippers dump name + URL into a single DB | Field-level mapping with transformation rules |
| 1b | Choosing the right DB is dropdown-heavy and brittle | Richer UI with search, recents, and context hints |
| 2a | Research across paper/book databases requires dropdown juggling per record | Recipes: pre-authored, one-click flows |
| 2b | The flow isn't reusable | Recipes stored in a portable Notion config DB |
| 3a | Need to look things up *before* saving (DOI, abstract, etc.) | Background enrichment steps inside recipes |
| 3b | After saving, can't ask "did I already clip this?" or "summarize my X-tagged items" | Extension reads existing DBs and surfaces insights |

> Long-term use cases for deeper queries (Pillar 3) are deliberately not fully scoped yet — the foundation is what matters now.

---

## 3. Architectural foundations

### 3.1 Extension framework

**Recommendation: WXT** (Web Extension Toolbox) with React 18 + TypeScript.

- Manifest V3-native.
- Best-in-class HMR for service workers (critical for MV3 dev loop).
- Framework-agnostic so we can pivot to Svelte/Solid later.
- Type-safe `wxt/storage` abstraction over `chrome.storage`.
- First-party Firefox support for future cross-browser reach.

Alternatives considered and rejected for this spec: Plasmo (more lock-in), vanilla MV3 + CRXJS (too much boilerplate), and vanilla without a bundler (UX too painful for a multi-context extension).

### 3.2 Authentication & distribution model

There is a deliberate tension in user answers:

- **Distribution goal:** Public Chrome Web Store (eventually).
- **MVP auth:** Internal-only token paste.
- **MVP backend:** None — fully client-side.

These three cannot all hold simultaneously at store submission, **but they can for the MVP.** The spec resolves this with a **swappable auth abstraction**:

```ts
interface AuthStrategy {
  getNotionToken(): Promise<string>;       // bearer token for Notion API
  getNotionVersion(): string;              // e.g. "2025-09-03"
  getUserHint(): Promise<{ workspaceId?: string }>;
}
class InternalTokenAuth implements AuthStrategy { /* paste-own-secret */ }
class OAuthBackendAuth  implements AuthStrategy { /* public OAuth, requires backend */ }
```

- **MVP ships `InternalTokenAuth`.**
- The extension is distributed as an unpacked `.zip` or private GitHub release.
- When ready for the store, a flag flips to `OAuthBackendAuth` and a thin serverless backend (Cloudflare Worker) handles the OAuth code exchange + token storage.
- **This decision is documented in the spec's `§9 Roadmap`** so we don't forget.

Chosen Notion API version: **`2025-09-03`** (handles the new Data Sources abstraction).

### 3.3 AI provider strategy

- **Primary: BYOK (Bring Your Own Key).** User pastes an OpenAI / Anthropic / OpenRouter / Gemini API key in the options page. Extension calls the API directly (with the relevant domain added to `host_permissions`).
- **Browser-native fallback:** Deferred. Chrome's Prompt API is not part of the beta because no supported local-model runtime has been implemented.
- **Routing rule:** Schema-bound extraction (Zod-validated JSON for property fields) uses the configured cloud provider. Smart Clip supports OpenAI, Anthropic, Google Gemini, and OpenRouter's free router.

### 3.4 Storage layout

- `chrome.storage.sync`: small, per-device-syncable prefs (BYOK enabled flag, last-used DB, theme).
- `chrome.storage.local`: large things — extraction history, queued retries, cached DB schemas, recipe run logs.
- **Configuration**: recipes, prebuilt-adapter overrides, and per-DB mappings live in **a dedicated Notion "Config DB"** the user creates once and shares with the integration. They are portable across devices and across extensions. Recipe JSON shape is constrained to the mobile-compatible invariants in §4.2.5.

---

## 4. Three pillars — detailed requirements

### 4.1 Pillar 1: Intelligent Data Transformation

#### Field extraction (layered)

Each user-defined field can be sourced from one of three layers, resolved in priority order:

1. **Site adapter (highest priority)** — prebuilt rules for known sites.
2. **CSS-selector rule** — user-defined `selector` matched against the current page DOM.
3. **AI extraction** — LLM call with the field's Zod schema; LLM returns JSON conforming to the schema, validated client-side.

If layer 1 fails, layer 2 is tried. If layer 2 fails, layer 3 runs. Failures are surfaced in the popup with a "Why did this fail?" tooltip.

#### Property mapping

- Map any extracted field to a Notion property *type-appropriate* slot.
- Type compatibility is enforced client-side:
  - `URL` extractor → `url`, `rich_text`, or `title` property.
  - `multi_select` extractor → `multi_select`, `select`, or `rich_text`.
  - If a property is `relation`, the user must additionally pick a target DB; the extension handles the resolution.
- If the LLM returns a value that doesn't fit (e.g., string for `number`), the extension either coerces or surfaces a per-field validation error.

#### Saving

- **Baseline default payload: `{ Name, URL }` plus any user-defined fields.** Body content is **not** saved by default.
- **Opt-in "Save full body" per database** — toggled in the popup or per-recipe. When enabled, the page body is parsed with `@mozilla/readability` plus a custom Normalizer and appended as Notion blocks (paragraph, heading, code, image, callout, quote, bookmark).
- **Selection-mode clip** — if the user has a text selection when invoking the extension, only the selection + page URL/metadata are submitted. A "summarize selection" button can use a configured cloud AI provider.

#### Image lifecycle (when "Save full body" is on)

Every image encountered in the cleaned DOM is processed before upload:

1. **Resolve absolute URL** with `new URL(src, pageUrl).href`.
2. **Filter junk** — discard tracking pixels (<16px in either dimension), lazy-load placeholders, base64 inlines larger than 50 KB.
3. **Re-encode via `OffscreenCanvas`** — downscale proportionally if width > 1600 px; export as JPEG `quality: 0.85`. (PNG is preserved only when alpha channel matters, then re-encoded losslessly only if already under 5 MiB.)
4. **Hash the bytes** with SHA-256. If the same hash appears across the page, upload once and reuse.
5. **Upload via Notion `file_upload` API** — single-file mode for ≤20 MiB, multipart (`POST /v1/file_uploads`, then `/v1/file_uploads/{id}/send` per chunk of 5–20 MiB) for larger. Sequential (`concurrency: 1`) to respect the 3 req/s Notion rate limit.

**On failure (size or otherwise):** the popup surfaces a per-image failure list. The user is offered two actions:

- **Save without images** — drop the offending images, save the rest of the row.
- **Replace with external URL** — fall back to `external` URL reference for the failing images. *Not chosen silently* — the user must opt in per row.

The extension queries `GET /v1/users/me` once per session to determine the workspace's `max_file_upload_size_in_bytes` and adjusts upload strategy (single vs multipart) accordingly.

#### UI

- **Popup layout** (right side of toolbar, ~360px wide):
  - Top: target database picker (search + recents + DB-type filters).
  - Middle: live preview of the row that *will* land in Notion. Fields are editable; underlying extractor shown in pale text below each value.
  - Bottom: "Save" + "Save and open recipe" + "Edit mappings".
- **Empty states**: "No databases shared with integration yet" with a link to the relevant Notion docs page.
- **Failure states**: per-field error with the option to retry just that field, override the value, or skip it.

### 4.2 Pillar 2: Workflow Automation ("Recipes")

A **recipe** is a named, ordered list of **steps** the user authors once and replays with one click from the popup or a keyboard shortcut.

#### 4.2.1 Plugin registry (extensible from day one)

Step types are NOT a closed enum. They are dispatched through an **extensible plugin registry** that maps a stable `kind: string` to a `RecipeStepHandler`. Any future contributor can add a step type without modifying the recipe runtime.

```ts
interface RecipeContext {
  pageUrl: string;
  selection?: string;
  // Addressed via JSONPath-style references, not closures.
  stepResults: Record<string, unknown>;
}

interface RecipeStepHandler<TParams = unknown, TResult = unknown> {
  readonly kind: string;          // e.g. "core:extract"
  readonly version: number;       // bump on breaking param changes
  readonly summary: string;       // shown in Builder dropdown
  readonly paramsSchema: ZodSchema<TParams>;
  execute(params: TParams, ctx: RecipeContext): Promise<TResult>;
}
```

**Built-in handlers ship with MVP** (these are *seeded*, not *closed*):

| Kind | Purpose |
|---|---|
| `core:setField` | Assign a static or AI-extracted value to a property. |
| `core:extract` | Layered extractor (adapter → CSS → AI). |
| `core:enrich` | External service lookup (Crossref, OpenAlex, Open Library, arXiv, GitHub). |
| `core:queryNotion` | Read from user's shared DBs (duplicate detection, related items). |
| `core:saveToNotion` | Write the final row to a target DB. |
| `core:chainRecipe` | Call another recipe (sub-recipes). |

#### 4.2.2 Recipe document schema (stored as a row in the Notion Config DB)

```ts
interface RecipeRow {
  id: string;                    // stable row ID from Notion
  name: string;                  // human label
  description?: string;
  targetDbId: string;            // the destination Notion DB
  triggers: Array<'page' | 'selection' | 'notionQuery' | 'notionPage'>;  // see 4.2.3
  requiredHandlers: string[];    // derived: kinds referenced by any step, e.g. "core:extract", "core:enrich"
  steps: RecipeStep[];           // ordered list
  enabled: boolean;
  schemaVersion: number;         // pin the *recipe document* shape (independent of step kinds)
}

interface RecipeStep {
  stepId: string;                // unique within recipe, used for cross-step refs
  kind: string;                  // must match a registered handler
  version: number;               // pin which handler version this step targets
  params: unknown;               // validated by the handler's paramsSchema
}
```

**Portability rule:** Every recipe row ships with a `requiredHandlers` array computed from its steps. When a user imports a recipe whose `requiredHandlers` are not all registered locally, the extension shows:

> *"3 of 4 step types installed locally. Missing: `community:crossref`."*

Missing-handler recipes appear in the Recipe Builder with a *broken* badge and refuse to run.

#### 4.2.3 Recipe input sources (MVP)

| Trigger | When it fires | Notes |
|---|---|---|
| `page` | User invokes the recipe on the active browser tab. | Default. |
| `selection` | User invokes with a text selection in the active tab. | Selected text replaces page body for extraction. |
| `notionQuery` | Recipe is invoked from a saved extension "Run on query result" panel. | The query result list is the input batch. |
| `notionPage` | Recipe is invoked *from within Notion* (e.g., right-click on a page row in a shared DB → "Run Enrichment"). | Requires Notion-side extension hook; documented under §5.3 Phase 2. |

**Explicitly deferred (not in MVP):**

- **List-of-inputs / batch paste** ("paste 10 DOIs and run recipe against each"). Deferred due to scope per round-4 user decision. Comes back in Phase 2.

#### 4.2.4 Recipe Builder UX

Two authoring modes co-exist:

- **Standard mode (default for typical users):** `+ Add step` dropdown shows ONLY locally-registered handler `kind`s, with friendly labels and a tailored form per step type (e.g., for `core:extract`, the form lets the user pick extractor priority layers + which Notion property to map to).
- **Power-user JSON mode:** a `{} Edit as JSON` toggle on each step (and on the whole recipe) lets power users type arbitrary `kind` strings and `params` payloads. The runtime validates with the handler's `paramsSchema` on save. Tampering with `kind`/`version` is allowed; tampering with `stepId` is rejected if any other step references it.

A `Run on current page (dry run)` button executes the recipe, returning the per-step results panel without writing to Notion. A `Save recipe` action upserts the Config DB row.

#### 4.2.5 Mobile-compatibility invariants on Recipe JSON

The Builder enforces (and the runtime double-checks) these invariants on every saved Recipe row. They exist so a future mobile companion reader app could import and parse them:

- **No JS closures or `eval`-able expressions.** Params are plain JSON only.
- **No DOM or browser references.** No `window`, `document`, `HTMLElement`, `chrome.*`, `browser.*`.
- **Inter-step data uses JSONPath strings.** A step that needs another step's output writes e.g. `params.doi: "$.steps.extract_doi.result"` — never a runtime reference.
- **All external identifiers (DB IDs, Recipe IDs) are Notion-native strings**, not extension-internal handles.

#### 4.2.6 Built-in seed recipes (starters)

Two prebuilt seed recipes ship with the MVP:

- **"Save arXiv paper"**: `core:extract` (title/authors/abstract/date/categories) → `core:enrich` via OpenAlex → `core:queryNotion` (dedupe by DOI) → `core:saveToNotion` to `Papers`.
- **"Save book from Amazon or Open Library"**: `core:extract` ISBN → `core:enrich` via Open Library → `core:queryNotion` (dedupe by ISBN) → `core:saveToNotion` to `Books`.

### 4.3 Pillar 3: Background Actions and Reads

#### Pre-save enrichment (`enrichFromExternal` step)

Built-in enrichment sources at MVP:

| Source | Used for | Auth | Cost |
|---|---|---|---|
| Crossref API | DOI → metadata | None | Free |
| OpenAlex | DOI/arXiv ID → metadata, citations | None | Free |
| Open Library | ISBN → book metadata | None | Free |
| arXiv API | arXiv ID → abstract, authors, categories | None | Free |
| GitHub REST API | GitHub URL → repo metadata | Optional PAT for higher rate limit | Free w/o PAT |

Extension adds the `host_permissions` for each, calls via `fetch()` from the background service worker. **No third-party API key leaves the browser.**

#### Reads against the Notion DBs (`queryNotion` step)

Three query types are required at MVP:

1. **`Find duplicate by URL/DOI/ISBN`** — before saving, run a filtered query against the target DB looking for an existing page with the same `url` (or DOI/ISBN) field. If found, present "Already saved 12 days ago: [link]. Update / Skip?" UX.
2. **Find-related + summarize (post-save)** — given a just-saved item, query the same DB for pages that share at least one tag, run a BYOK LLM synthesis ("Here are 9 papers you've saved tagged 'transformers' — synthesis of the threads..."), and write the synthesis as a child page or comment.
3. **Bulk query for re-tagging / cleanup** — manual trigger from the popup: pick a DB + a tag extractor prompt, run it across all rows in batch (with chunking + progress). Used for retroactive cleanup.

**Out of scope for MVP**, kept for post-MVP:

- Cross-DB relation auto-resolution (would need a richer Notion schema and likely more rate-limit budget).
- Recursive cite-graph traversal.

---

## 5. MVP scope

### 5.1 In-MVP

- Internal-token auth (`InternalTokenAuth`).
- BYOK for OpenAI/Anthropic/OpenRouter/Gemini.
- Target DB picker with search + recents.
- Layered extraction (CSS selector → AI → manual override).
- Field-level mapping with type validation.
- Save with baseline `Name + URL + user-defined fields`.
- Selection-mode clip with an optional cloud-AI summary.
- **Image lifecycle**: OffscreenCanvas compression (max 1600 px wide, JPEG q85), SHA-256 dedupe, sequential direct upload with per-image failure UX.
- Two prebuilt site adapters (arXiv, Amazon Books) plus their seed recipes.
- **Extensible recipe plugin registry** (`RecipeStepHandler` interface + 6 built-in handlers).
- Recipe Builder GUI (drag/drop steps; standard mode + power-user JSON mode).
- Recipe trigger sources: `page`, `selection`, `notionQuery`, `notionPage` (`notionPage` arrives in Phase 2 per the trigger table in §4.2.3).
- Crossref, OpenAlex, Open Library, arXiv enrichment steps.
- `Find duplicate by URL/DOI/ISBN` query before every save.
- Retry queue for failed saves (rate limit / network / 5xx) with exponential backoff.
- **Drafts mode**: clip offline, row held in `chrome.storage.local` under `draft:{uuid}` + `index:drafts`, auto-promotes into sync queue on reconnect with conflict detection via dedupe query.
- Config DB stored in Notion, with JSON Shape restricted to mobile-compatible invariants.

### 5.2 Explicitly NOT in MVP

- OAuth / backend server (deferred to public-store launch).
- Chrome Web Store submission / privacy disclosures / store compliance.
- Find-related + summarize service (post-save)  — too LLM-expensive for MVP; comes in Phase 2.
- Bulk query / re-tagging — Phase 3.
- Cross-DB relation auto-resolution — Phase 3.
- Firefox build (target Chrome/Edge for MVP; WXT makes Firefox "free" later).
- Mobile companion reader app (recipe JSON is mobile-compatible by design, no app is shipping in MVP).
- **Batch list-trigger / "paste 10 DOIs" recipe mode** — explicit per round-4 decision; comes in Phase 2.

### 5.3 Phasing (post-MVP roadmap)

| Phase | Adds |
|---|---|
| Phase 1.5 | More prebuilt site adapters (PubMed, Scholar, GitHub, Substack, NYT, Amazon products, X/Twitter threads, YouTube). |
| Phase 2 | Recipe runtime v2: sub-recipes, conditional steps, schedules, "if this then that" triggers. Find-related + summarize service. |
| Phase 3 | Bulk query + cleanup view. Cross-DB relation auto-resolution. Webhook receiver (requires backend) for Notion → extension syncs. |
| Phase 4 | OAuth backend. Chrome Web Store submission. Firefox build. |

---

## 6. Detailed UX flows

### 6.1 First-run onboarding

1. Install unpacked → welcome page opens.
2. "Connect Notion" → opens Notion developer portal in a new tab, copyable checklist:
   - Create integration.
   - Copy secret token.
   - Back in extension: paste token (with reveal toggle).
   - "Pick a Notion DB to test" — pulls list of DBs shared with the integration.
3. "Pick an AI provider" — connect a supported provider for cloud-assisted extraction.
4. Optional: "Create your Config DB" — one-click template creation in Notion.
5. Optional: "Try the arXiv sample recipe" — guides through one real clip.

### 6.2 A typical clip

1. User is on `arxiv.org/abs/2401.01234`.
2. Clicks the extension icon (or keyboard shortcut).
3. Popup opens with the arXiv adapter pre-matched, schema preview filled (title, authors, abstract, date, categories).
4. User picks target DB (`Papers`) from a search list with recents at top.
5. Optional: user toggles "Find duplicates" — pre-save query runs, surfaces prior `2401.01234` clip if any.
6. Optional: user clicks "Enrich via Crossref" — pulls full author affiliations, journal ref.
7. User reviews the preview row (with edit-in-place on any field).
8. Clicks **Save**. Row lands in Notion within ~2s. Toast confirms and offers "Open in Notion".

### 6.3 Authoring a recipe

1. User opens side panel via toolbar → "Recipes" tab.
2. Clicks `New recipe`.
3. Names it "Save people"; targets `People` DB.
4. Adds steps via `+` menu:
   - Step 1: `extractFromUrl` — `fullName` from `<h1>` selector or AI fallback.
   - Step 2: `extractFromUrl` — `currentRole` from selector, then AI prompt "What is this person's current role per the page".
   - Step 3: `queryNotion` — find duplicate by `url`, if found abort.
   - Step 4: `saveToNotion` — to `People` DB.
5. Clicks `Run on current page (dry run)`.
6. Recipe executes; dry-run result shown in a panel with all extracted values.
7. Clicks `Save recipe` → row upserted into Config DB.

### 6.4 Failed-save recovery

- Failed saves are queued locally in `chrome.storage.local`.
- Popup surfaces a "queued (3 failed)" badge.
- Background service worker retries with exponential backoff (1s, 4s, 16s, 60s, … capped at 10m).
- On retry success, row is silently inserted and the queued item disappears.
- On hard failure (e.g., invalid token), a per-item "Why did this fail?" inspector is shown with "Discard" and "Edit and retry" actions.

### 6.5 Drafts (offline) mode

Distinct from the retry queue (which holds unexpected failures), a **draft** is a row the user explicitly clipped while offline:

- **Storage:** `chrome.storage.local[draft:{uuid}]` for each draft, plus an `index:drafts` array for fast enumeration.
- **UI:** A "Drafts" tab in the popup. Drafts show extraction summary, target DB chosen, and a timestamp. The user can edit fields, pick a different DB, or discard.
- **On reconnect:** drafts auto-promote into the sync queue. Before each draft syncs, the extension runs the recipe's `core:queryNotion` deduplication step. If a matching row appeared in Notion during the offline window (e.g., created from another device), the draft halts and shows a **Conflict** badge in the Drafts UI: *"This looks like it was already saved on Synced Phone 12 minutes ago. Overwrite / Discard?"*
- **Mid-connection loss:** if connectivity drops *during* a save, the row is promoted to a draft automatically with the partially-attached state preserved (specifically, image file_upload IDs that didn't complete are tagged).

---

## 7. Permissions and security

### 7.1 Manifest V3 permissions required

```jsonc
{
  "manifest_version": 3,
  "permissions": [
    "storage",          // for chrome.storage + queue
    "activeTab",        // minimal-scope tab access
    "scripting",        // programmatic content script injection
    "contextMenus"      // right-click "Clip selection"
  ],
  "host_permissions": [
    "https://api.notion.com/*",
    "https://api.openai.com/*",
    "https://api.anthropic.com/*",
    "https://openrouter.ai/api/*",
    "https://generativelanguage.googleapis.com/*",
    "https://api.crossref.org/*",
    "https://api.openalex.org/*",
    "https://openlibrary.org/*",
    "https://export.arxiv.org/*",
    "https://api.github.com/*"
  ],
  "optional_host_permissions": ["<all_urls>"]  // user grants per-site as needed
}
```

### 7.2 Security posture

- BYOK API keys stored in `chrome.storage.local`, never send to any server.
- Notion token stored in `chrome.storage.local`, never send to any server.
- Page content is sent to external services **only** when a user-initiated action requires it (extraction, enrichment). A clear toggle in options: *"Send full page text to my AI provider when extracting"* (off by default — text is summarized/truncated first).
- No third-party analytics, no telemetry, no phone-home.

### 7.3 PII handling

- Before sending to an external LLM, the extension strips:
  - Email addresses (regex).
  - Phone numbers (regex).
  - Long digit sequences (credit-card candidates).
- User-configurable allowlist of regex patterns to additionally mask.
- A "*Why is this content being sent?*" link in the popup logs each outbound request.

---

## 8. Technical architecture (file/module layout)

```
src/
  extension/
    entrypoints/
      background.ts            // service worker
      content.ts              // content script (DOM extraction, Readability)
      popup/                  // toolbar popup (React)
      sidepanel/              // Recipe Builder, history
      options/                // token, BYOK, advanced settings
  core/
    auth/
      AuthStrategy.ts         // interface
      InternalTokenAuth.ts    // MVP
      OAuthBackendAuth.ts     // stub for Phase 4
    notion/
      client.ts               // Notion API wrapper (auto-retry, rate limit)
      schemas.ts              // zod schemas for Notion property types
      pages.ts                // createPage, queryDatabase, findDuplicate
    extraction/
      readability.ts          // @mozilla/readability wrapper
      cssSelector.ts          // layer 2
      aiExtractor.ts          // layer 3 (cloud AI)
      adapters/
        arxiv.ts
        amazonBooks.ts
        openLibrary.ts
    ai/
      router.ts               // provider decision logic
      providers/
        openai.ts
        anthropic.ts
        openrouter.ts
        gemini.ts
      schemas.ts              // zod schemas per extraction field
    recipes/
      registry.ts             // RecipeStepHandler registry + kind lookup
      types.ts                // RecipeRow, RecipeStep, RecipeContext types
      runner.ts               // executes a recipe
      builder.tsx             // GUI for authoring (standard + JSON mode)
      configDb.ts             // recipe persistence to Notion Config DB
      handlers/               // MVP built-in handlers (one file per kind)
        setField.ts
        extract.ts
        enrich.ts
        queryNotion.ts
        saveToNotion.ts
        chainRecipe.ts
      drafts.ts               // offline draft storage + sync promotion
    enrichment/
      crossref.ts
      openalex.ts
      openLibrary.ts
      arxiv.ts
      github.ts
    queries/
      findDuplicate.ts
      findRelated.ts          // post-MVP
      bulkRetag.ts            // post-MVP
  storage/
    chromeStorage.ts          // typed wrappers around chrome.storage
    settings.ts               // synced prefs (theme, last DB)
    queue.ts                  // failed-save retry queue
  ui/
    components/...
    theme.ts
  shared/
    types.ts                  // Notion property types, recipe types, etc.
public/
  icons/
  manifest.json               // auto-generated by WXT
```

---

## 9. Open questions left over (resolved v2)

After round-4 interview these are now locked:

1. **Config DB schema finalization →** **Extensible plugin registry in MVP.** See §4.2.1 — `RecipeStepHandler` interface + `RecipeRow.requiredHandlers` + portable-handler-detection UX. The seed handler set is documented in §4.2.1 but the type set itself is open.
2. **Recipe input sources →** **MVP supports `page`, `selection`, `notionQuery`, `notionPage` (Phase 2).** Batch "list of inputs / paste 10 DOIs" is **explicitly deferred** per round-4 decision; see §4.2.3.
3. **Image handling →** **Always direct upload after compress-first** (OffscreenCanvas, max-width 1600 px, JPEG q85, SHA-256 dedupe, sequential uploads respecting 3 req/s). On size failure the user chooses Save-without-images or Replace-with-external-URL — no silent fallback. Notion workspace tier capped via `/v1/users/me`. (Note: spec v1 mentioned "20MB"; v2 corrects this to "5 MiB free / 5 GiB paid" which is the real limit, and the >20 MiB multipart threshold.) See §4.1 "Image lifecycle".
4. **Mobile companion app →** **Mobile-compatible data only.** No mobile app is planned in MVP, but the Recipe JSON shape is restricted to mobile-compatible invariants (no closures, no DOM, no extension namespaces, JSONPath addressing) so a future reader app can import them. See §4.2.5.
5. **Offline mode →** **Drafts mode for clips** (§6.5). Beyond the existing failed-save retry queue, users can clip while offline, drafts auto-sync on reconnect, conflicts are surfaced.

**Items still genuinely open (not blocking spec):**

- Success metrics in §11 — to be confirmed with the user before MVP build.
- Visual design system — companion `notion-clipper-product-design.md` doc.
- Long-tail query use cases for Pillar 3 — opportunistically shaped by §4.3 + Phase 3.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Notion `2025-09-03` Data Sources transition breaks older DBs | Pin Notion-Version header explicitly; document migration in help docs. |
| LLM returns JSON that fails Zod validation | Auto-retry once with the validation error message appended; on second failure, show user the raw output and a "manual edit" UX. |
| Page parsing on JS-heavy SPAs produces empty body | `@mozilla/readability` fallback; if empty, give a clear "Could not extract body — save metadata only?" prompt. |
| LLM cost surprises for users | Per-extraction token estimate shown in popup; weekly usage summary in options page. |
| Rate limit storms (3 req/sec on Notion) | Built-in request queue with backoff; bulk operations are chunked (10 rows/30s). |
| Recipe society fragmentation (people publish recipes whose handlers don't exist locally) | Every Recipe row carries `requiredHandlers`. Recipes with missing handlers are marked **broken** in the Recipe Builder with a precise list ("3 of 4 installed; missing `community:crossref`"); they refuse to run. The runtime also pins `schemaVersion` on the Recipe document *and* `version` per step entry for forward compat. |
| Always-upload image fails the workspace-tier cap (5 MiB free workspaces) | Don't degrade silently. Per-image failure list in the popup with explicit **Save without images** / **Replace with external URL** user choice — see §4.1. |
| Offline drafts collide with rows created from another device during the offline window | Drafts run `core:queryNotion` dedupe pre-sync, surface **Conflict** badge, and refuse auto-promote until user resolves — see §6.5. |

---

## 11. Success metrics (to define with the user before build)

To be nailed down before/during MVP:

- Time from "first time hearing about the extension" → "first successful clip" target: < 3 minutes.
- Number of clipped rows per active user per week target: ≥ 10.
- Recipe authoring success rate: ≥ 70% of users who start a recipe save it.
- Crash-free session rate target: ≥ 99%.

These should be confirmed before implementation, not deferred.

---

## 12. What's *not* in this spec

- Visual design system details (typography, spacing, motion).
- A/B test plans.
- Marketing / landing page copy.
- Pricing (assumed free, BYOK model).

These are intentionally separated from the spec to avoid scope creep. They belong in a `notion-clipper-product-design.md` companion doc.
