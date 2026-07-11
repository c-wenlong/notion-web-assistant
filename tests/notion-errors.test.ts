import assert from "node:assert/strict";
import test from "node:test";
import { approvedNotionProperties, normalizeAiFields, parseOpenAiAnalysis } from "../src/core/ai/analyze";
import { validateAiProvider } from "../src/core/ai/connection";
import { clipperFlowReducer, initialClipperFlow } from "../src/core/clipper/flow";
import { formatNotionError } from "../src/core/notion/errors";
import { resolveDestinationSchema } from "../src/core/notion/schema";

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
    tags: { multi_select: [{ name: "AI" }] },
    published: { date: { start: "2026-07-11" } },
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
