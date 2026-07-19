import assert from "node:assert/strict";
import test from "node:test";
import { parseHTML } from "linkedom";
import { analyzeWithProvider, approvedNotionProperties, normalizeAiFields, parseOpenAiAnalysis } from "../src/core/ai/analyze";
import { validateAiProvider } from "../src/core/ai/connection";
import { clipperFlowReducer, initialClipperFlow } from "../src/core/clipper/flow";
import { formatNotionError } from "../src/core/notion/errors";
import { getActivePageMetadata } from "../src/core/page/activeTab";
import { extractPageText, originalPageText } from "../src/core/page/extraction";
import {
  createNotionClipWithClient,
  findNotionClipDuplicateWithClient,
  overwriteNotionClipWithClient,
  type NotionApiClient,
} from "../src/core/notion/pageClient";
import { resolveDestinationSchema } from "../src/core/notion/schema";
import { restrictLocalStorageToTrustedContexts } from "../src/core/security/storageAccess";

test("Defuddle removes page chrome while preserving the main article", () => {
  const paragraph =
    "This research paper describes a careful evaluation of retrieval systems, including the experimental method, measured outcomes, limitations, and conclusions for future work. ";
  const { document } = parseHTML(`<!doctype html><html><head><title>Research paper</title></head><body>
    <nav>Navigation Account Pricing Products</nav>
    <main><article><h1>Reliable retrieval systems</h1><p>${paragraph.repeat(5)}</p><p>${paragraph.repeat(5)}</p></article></main>
    <footer>Terms Privacy Careers Newsletter</footer>
  </body></html>`);

  const original = originalPageText(document);
  const extracted = extractPageText(document, "https://example.com/research");

  assert.match(original, /Navigation Account Pricing/);
  assert.match(extracted, /Reliable retrieval systems/);
  assert.doesNotMatch(extracted, /Navigation Account Pricing/);
  assert.doesNotMatch(extracted, /Terms Privacy Careers/);
});

test("the extraction setting selects Defuddle or the original page reader", async () => {
  const injections: unknown[] = [];
  const previousChrome = (globalThis as { chrome?: unknown }).chrome;
  (globalThis as { chrome?: unknown }).chrome = {
    tabs: { query: async () => [{ id: 42 }] },
    scripting: {
      executeScript: async (injection: unknown) => {
        injections.push(injection);
        return [{ result: { title: "Page", url: "https://example.com", text: "Content" } }];
      },
    },
  };

  try {
    await getActivePageMetadata(true);
    await getActivePageMetadata(false);
  } finally {
    (globalThis as { chrome?: unknown }).chrome = previousChrome;
  }

  assert.deepEqual(injections[0], {
    target: { tabId: 42 },
    files: ["page-extractor.js"],
  });
  assert.equal(typeof (injections[1] as { func?: unknown }).func, "function");
});

test("keeps Notion validation details instead of replacing them with a guessed schema error", () => {
  const message = formatNotionError(400, {
    code: "validation_error",
    message: "body failed validation: URL is not a property that exists.",
  });

  assert.match(message, /URL is not a property that exists/);
});

test("uses the title property and requests a URL column when one is absent", () => {
  const schema = resolveDestinationSchema({
    Name: { id: "title", type: "title" },
    Authors: { id: "authors", type: "rich_text" },
  });

  assert.deepEqual(schema, {
    titleKey: "title",
    urlKey: "URL",
    needsUrlColumn: true,
  });
});

test("reuses an existing URL-type property even when it has been renamed", () => {
  const schema = resolveDestinationSchema({
    Name: { id: "title", type: "title" },
    Source: { id: "source", type: "url" },
  });

  assert.deepEqual(schema, {
    titleKey: "title",
    urlKey: "source",
    needsUrlColumn: false,
  });
});

test("keeps only schema-compatible AI values and builds valid Notion properties", () => {
  const fields = normalizeAiFields(
    [
      { id: "summary", name: "Summary", type: "rich_text", options: [] },
      { id: "status", name: "Status", type: "select", options: ["To read", "Read"] },
      { id: "tags", name: "Tags", type: "multi_select", options: ["AI", "Agents"] },
      { id: "published", name: "Published", type: "date", options: [] },
    ],
    [
      { id: "summary", value: "A concise summary." },
      { id: "status", value: "Invented option" },
      { id: "tags", value: ["AI", "Not in schema"] },
      { id: "published", value: "2026-07-11" },
    ],
  );

  assert.deepEqual(approvedNotionProperties(fields), {
    summary: { rich_text: [{ type: "text", text: { content: "A concise summary." } }] },
    status: { select: null },
    tags: { multi_select: [{ name: "AI" }] },
    published: { date: { start: "2026-07-11" } },
  });
});

test("writes explicit empty values when a reviewed Smart Clip field is cleared", () => {
  const properties = approvedNotionProperties([
    { id: "text", name: "Text", type: "rich_text", options: [], value: null },
    { id: "number", name: "Number", type: "number", options: [], value: null },
    { id: "checked", name: "Checked", type: "checkbox", options: [], value: null },
    { id: "select", name: "Select", type: "select", options: ["Paper"], value: null },
    { id: "tags", name: "Tags", type: "multi_select", options: ["AI"], value: [] },
    { id: "date", name: "Date", type: "date", options: [], value: null },
  ]);

  assert.deepEqual(properties, {
    text: { rich_text: [] },
    number: { number: null },
    checked: { checkbox: false },
    select: { select: null },
    tags: { multi_select: [] },
    date: { date: null },
  });
});

test("keeps a new single-select value when the Notion field has no options yet", () => {
  const fields = normalizeAiFields(
    [{ id: "year", name: "Year", type: "select", options: [] }],
    [{ id: "year", value: "2025" }],
  );

  assert.equal(fields[0]?.value, "2025");
  assert.deepEqual(approvedNotionProperties(fields), {
    year: { select: { name: "2025" } },
  });
});

test("parses a fenced JSON draft from a Responses API message", () => {
  const fields = parseOpenAiAnalysis(
    {
      output: [
        {
          type: "message",
          content: [
            { type: "output_text", text: "```json\n{\"fields\":[{\"id\":\"summary\",\"value\":\"A paper summary.\"}]}\n```" },
          ],
        },
      ],
    },
    [{ id: "summary", name: "Summary", type: "rich_text", options: [] }],
  );

  assert.equal(fields[0]?.value, "A paper summary.");
});

test("ignores Responses API reasoning metadata before the output message", () => {
  const fields = parseOpenAiAnalysis(
    {
      output: [
        { type: "reasoning", id: "rs_internal_metadata", summary: [] },
        {
          type: "message",
          content: [
            { type: "output_text", text: '{"fields":[{"id":"summary","value":"Parsed answer."}]}' },
          ],
        },
      ],
    },
    [{ id: "summary", name: "Summary", type: "rich_text", options: [] }],
  );

  assert.equal(fields[0]?.value, "Parsed answer.");
});

test("requests a strict OpenAI schema so valid JSON cannot omit the fields array", async () => {
  const fields = [{ id: "summary", name: "Summary", type: "rich_text" as const, options: [] }];
  const result = await analyzeWithProvider({
    provider: "openai",
    apiKey: "sk-test",
    page: { title: "Article", url: "https://example.com/article", text: "A useful summary." },
    fields,
    fetcher: async (_url, init) => {
      const body = JSON.parse(String(init.body)) as {
        text?: { format?: { type?: string; strict?: boolean; schema?: unknown } };
      };
      const format = body.text?.format;
      const outputText = format?.type === "json_schema"
        ? '{"fields":[{"id":"summary","value":"A useful summary."}]}'
        : '{"summary":"A useful summary."}';

      assert.equal(format?.type, "json_schema");
      assert.equal(format?.strict, true);
      assert.ok(format?.schema);
      return new Response(JSON.stringify({ output_text: outputText }), { status: 200 });
    },
  });

  assert.equal(result[0]?.value, "A useful summary.");
});

test("uses Anthropic's Messages API for Smart Clip analysis", async () => {
  const fields = [{ id: "year", name: "Year", type: "select" as const, options: [] }];
  const result = await analyzeWithProvider({
    provider: "anthropic",
    apiKey: "sk-ant-test",
    page: { title: "Paper", url: "https://example.com/paper", text: "Published in 2025." },
    fields,
    fetcher: async (url, init) => {
      assert.equal(url, "https://api.anthropic.com/v1/messages");
      assert.equal(new Headers(init.headers).get("x-api-key"), "sk-ant-test");
      assert.equal(new Headers(init.headers).get("anthropic-version"), "2023-06-01");
      const body = JSON.parse(String(init.body)) as { messages?: Array<{ content?: string }> };
      assert.match(body.messages?.[0]?.content ?? "", /Published in 2025/);
      return new Response(JSON.stringify({
        content: [{ type: "text", text: '{"fields":[{"id":"year","value":"2025"}]}' }],
      }), { status: 200 });
    },
  });

  assert.equal(result[0]?.value, "2025");
});

test("uses Google Gemini's generateContent API for Smart Clip analysis", async () => {
  const fields = [{ id: "year", name: "Year", type: "select" as const, options: [] }];
  const result = await analyzeWithProvider({
    provider: "gemini",
    apiKey: "AIza-test",
    page: { title: "Paper", url: "https://example.com/paper", text: "Published in 2025." },
    fields,
    fetcher: async (url, init) => {
      assert.match(url, /models\/gemini-2\.5-flash:generateContent$/);
      assert.equal(new Headers(init.headers).get("x-goog-api-key"), "AIza-test");
      const body = JSON.parse(String(init.body)) as { generationConfig?: { responseMimeType?: string } };
      assert.equal(body.generationConfig?.responseMimeType, "application/json");
      return new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: '{"fields":[{"id":"year","value":"2025"}]}' }] } }],
      }), { status: 200 });
    },
  });

  assert.equal(result[0]?.value, "2025");
});

test("uses OpenRouter's free model router for Smart Clip analysis", async () => {
  const fields = [{ id: "year", name: "Year", type: "select" as const, options: [] }];
  const result = await analyzeWithProvider({
    provider: "openrouter",
    apiKey: "sk-or-test",
    page: { title: "Paper", url: "https://example.com/paper", text: "Published in 2025." },
    fields,
    fetcher: async (url, init) => {
      assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(new Headers(init.headers).get("Authorization"), "Bearer sk-or-test");
      const body = JSON.parse(String(init.body)) as { model?: string; response_format?: { type?: string } };
      assert.equal(body.model, "openrouter/free");
      assert.equal(body.response_format?.type, "json_object");
      return new Response(JSON.stringify({
        choices: [{ message: { content: '{"fields":[{"id":"year","value":"2025"}]}' } }],
      }), { status: 200 });
    },
  });

  assert.equal(result[0]?.value, "2025");
});

test("checks an OpenAI key against its read-only models endpoint", async () => {
  let requestedUrl = "";
  let authorization = "";

  await validateAiProvider("openai", "sk-test", async (url, init) => {
    requestedUrl = url;
    authorization = new Headers(init.headers).get("Authorization") ?? "";
    return new Response("{}", { status: 200 });
  });

  assert.equal(requestedUrl, "https://api.openai.com/v1/models");
  assert.equal(authorization, "Bearer sk-test");
});

test("keeps Gemini API keys out of validation URLs", async () => {
  let requestedUrl = "";
  let apiKey = "";

  await validateAiProvider("gemini", "AIza-test", async (url, init) => {
    requestedUrl = url;
    apiKey = new Headers(init.headers).get("x-goog-api-key") ?? "";
    return new Response("{}", { status: 200 });
  });

  assert.equal(requestedUrl, "https://generativelanguage.googleapis.com/v1beta/models");
  assert.equal(apiKey, "AIza-test");
});

test("sends each Notion field's description to the AI provider", async () => {
  let prompt = "";
  const fields = [
    {
      id: "audience",
      name: "Audience",
      type: "select" as const,
      options: ["Research", "Engineering"],
      description: "Who the article is written for.",
    },
  ];

  await analyzeWithProvider({
    provider: "openai",
    apiKey: "sk-test",
    page: { title: "Paper", url: "https://example.com/paper", text: "A paper for engineers." },
    fields,
    fetcher: async (_url, init) => {
      const body = JSON.parse(String(init.body)) as { input: string };
      prompt = body.input;
      return new Response(
        JSON.stringify({ output_text: '{"fields":[{"id":"audience","value":"Engineering"}]}' }),
        { status: 200 },
      );
    },
  });

  const parsed = JSON.parse(prompt) as {
    rules: string[];
    fields: Array<{ id: string; description?: string }>;
  };
  assert.equal(parsed.fields[0]?.description, "Who the article is written for.");
  assert.ok(parsed.rules.some((rule) => /description/.test(rule)));
});

test("bounds Smart Clip data sent to AI providers", async () => {
  let prompt = "";
  const fields = Array.from({ length: 51 }, (_, index) => ({
    id: `field-${index}`,
    name: "Field".repeat(50),
    type: "rich_text" as const,
    options: Array.from({ length: 51 }, () => "Option".repeat(30)),
  }));

  const result = await analyzeWithProvider({
    provider: "openai",
    apiKey: "sk-test",
    page: {
      title: "Page",
      url: "https://example.com/page",
      text: "x".repeat(60_100),
    },
    fields,
    fetcher: async (_url, init) => {
      const body = JSON.parse(String(init.body)) as { input: string };
      prompt = body.input;
      return new Response(JSON.stringify({ output_text: "{\"fields\":[]}" }), { status: 200 });
    },
  });
  const parsedPrompt = JSON.parse(prompt) as {
    page: { text: string };
    fields: Array<{ name: string; options: string[] }>;
  };

  assert.equal(parsedPrompt.page.text.length, 60_000);
  assert.equal(parsedPrompt.fields.length, 50);
  assert.equal(parsedPrompt.fields[0]?.name.length, 160);
  assert.equal(parsedPrompt.fields[0]?.options.length, 50);
  assert.equal(parsedPrompt.fields[0]?.options[0]?.length, 120);
  assert.equal(result.length, 50);
});

test("does not include provider error bodies in user-facing failures", async () => {
  await assert.rejects(
    analyzeWithProvider({
      provider: "openai",
      apiKey: "sk-test",
      page: { title: "Page", url: "https://example.com", text: "Text" },
      fields: [],
      fetcher: async () => new Response("provider echoed sensitive page content", { status: 500 }),
    }),
    (error: Error) => !error.message.includes("sensitive page content"),
  );
});

test("prefers an existing URL property even when another property is named URL", () => {
  const schema = resolveDestinationSchema({
    Name: { id: "title", type: "title" },
    URL: { id: "url-text", type: "rich_text" },
    Source: { id: "url", type: "url" },
  });

  assert.deepEqual(schema, { titleKey: "title", urlKey: "url", needsUrlColumn: false });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function queuedNotionClient(responses: Response[], calls: Array<{ url: string; init: RequestInit }>): NotionApiClient {
  return {
    token: "secret_test",
    version: "2025-09-03",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      const response = responses.shift();
      if (!response) throw new Error(`Unexpected request: ${url}`);
      return response;
    },
  };
}

test("duplicate preflight does not add a URL property before user approval", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const result = await findNotionClipDuplicateWithClient(
    { dataSourceId: "source-id", url: "https://example.com/paper" },
    queuedNotionClient([jsonResponse({ properties: { Name: { id: "title", type: "title" } } })], calls),
  );

  assert.equal(result, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.init.method, undefined);
});

test("approved create adds the missing URL property and saves title plus URL", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const result = await createNotionClipWithClient(
    { dataSourceId: "source-id", title: "Paper", url: "https://example.com/paper" },
    queuedNotionClient([
      jsonResponse({ properties: { Name: { id: "title", type: "title" } } }),
      jsonResponse({}),
      jsonResponse({ results: [] }),
      jsonResponse({ url: "https://www.notion.so/new-page" }),
    ], calls),
  );

  assert.deepEqual(result, { kind: "created", pageUrl: "https://www.notion.so/new-page" });
  assert.equal(calls[1]?.init.method, "PATCH");
  assert.deepEqual(JSON.parse(String(calls[1]?.init.body)), {
    properties: { URL: { type: "url", url: {} } },
  });
  assert.equal(calls[2]?.url.endsWith("/query"), true);
  assert.deepEqual(JSON.parse(String(calls[3]?.init.body)), {
    parent: { type: "data_source_id", data_source_id: "source-id" },
    properties: {
      title: { title: [{ type: "text", text: { content: "Paper" } }] },
      URL: { url: "https://example.com/paper" },
    },
  });
});

test("stale duplicate approval never patches a different Notion page", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  await assert.rejects(
    overwriteNotionClipWithClient(
      "approved-page",
      { dataSourceId: "source-id", title: "Paper", url: "https://example.com/paper" },
      queuedNotionClient([
        jsonResponse({ properties: { Name: { id: "title", type: "title" }, URL: { id: "url", type: "url" } } }),
        jsonResponse({ results: [{ id: "different-page", url: "https://www.notion.so/different" }] }),
      ], calls),
    ),
    /matching Notion row changed/,
  );

  assert.equal(calls.length, 2);
  assert.equal(calls.some((call) => call.url.endsWith("/pages/approved-page")), false);
});

test("sets Chrome local storage to trusted contexts", async () => {
  let accessLevel: string | undefined;
  await restrictLocalStorageToTrustedContexts({
    setAccessLevel: async (details) => {
      accessLevel = details.accessLevel;
    },
  });

  assert.equal(accessLevel, "TRUSTED_CONTEXTS");
});

test("does not save a provider key when its connection check is rejected", async () => {
  await assert.rejects(
    validateAiProvider("openai", "sk-invalid", async () => new Response("{}", { status: 401 })),
    /did not accept that API key/,
  );
});

test("keeps analysis local until a user approves and then records the saved Notion page", () => {
  const analyzed = clipperFlowReducer(initialClipperFlow, { type: "analysisStarted" });
  assert.deepEqual(analyzed, { screen: "clip", analyzing: true, analysisError: null });

  const reviewing = clipperFlowReducer(analyzed, {
    type: "analysisReady",
    fields: [{ id: "year", name: "Year", type: "select", options: [], value: "2025" }],
  });
  assert.equal(reviewing.screen, "review");
  if (reviewing.screen !== "review") throw new Error("Expected review state");
  assert.equal(reviewing.savedPageUrl, null);

  const saving = clipperFlowReducer(reviewing, { type: "approvalStarted" });
  assert.equal(saving.screen, "review");
  if (saving.screen !== "review") throw new Error("Expected review state");
  assert.equal(saving.saving, true);

  const duplicate = clipperFlowReducer(saving, { type: "approvalDuplicate" });
  assert.deepEqual(duplicate, { ...reviewing, saving: false });

  const saved = clipperFlowReducer(saving, {
    type: "approvalSaved",
    pageUrl: "https://www.notion.so/saved-row",
  });
  assert.deepEqual(saved, {
    ...reviewing,
    saving: false,
    savedPageUrl: "https://www.notion.so/saved-row",
  });
});
