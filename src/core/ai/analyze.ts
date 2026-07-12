import type { NotionField } from "~/core/notion/fields";
import type { PageMetadata } from "~/shared/pageMetadata";
import type { ByokProvider } from "~/storage/items";

export type DraftValue = string | number | boolean | string[] | null;

export interface ReviewField extends NotionField {
  value: DraftValue;
}

export interface OpenAiResponse {
  output_text?: unknown;
  output?: unknown;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

interface AiResponseField {
  id?: unknown;
  value?: unknown;
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const GEMINI_GENERATE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const ANALYSIS_MODEL = "gpt-5.4-mini";
const ANTHROPIC_ANALYSIS_MODEL = "claude-haiku-4-5-20251001";
const OPENROUTER_FREE_MODEL = "openrouter/free";
const MAX_RICH_TEXT_LENGTH = 2000;
const MAX_ANALYSIS_TEXT_LENGTH = 60_000;
const MAX_ANALYSIS_FIELDS = 50;
const MAX_FIELD_NAME_LENGTH = 160;
const MAX_FIELD_OPTIONS = 50;
const MAX_FIELD_OPTION_LENGTH = 120;

function outputText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = outputText(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.type === "output_text" && typeof record.text === "string") return record.text;
  if (typeof record.output_text === "string") return record.output_text;
  for (const [key, child] of Object.entries(record)) {
    // Response metadata such as `type: "message"` is not model content.
    if (key === "type" || key === "role") continue;
    const found = outputText(child);
    if (found) return found;
  }
  return null;
}

function fieldValue(field: NotionField, value: unknown): DraftValue {
  switch (field.type) {
    case "rich_text":
    case "date":
      if (typeof value !== "string" || !value.trim()) return null;
      return field.type === "rich_text"
        ? value.trim().slice(0, MAX_RICH_TEXT_LENGTH)
        : value.trim();
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    case "checkbox":
      return typeof value === "boolean" ? value : null;
    case "select":
      if (typeof value !== "string" || !value.trim()) return null;
      if (value.includes(",")) return null;
      return field.options.length === 0 || field.options.includes(value) ? value : null;
    case "multi_select":
      if (!Array.isArray(value)) return [];
      return value.filter(
        (item): item is string =>
          typeof item === "string" &&
          !item.includes(",") &&
          (field.options.length === 0 || field.options.includes(item)),
      );
  }
}

/** Convert untrusted AI JSON into values that match supported Notion field types. */
export function normalizeAiFields(fields: NotionField[], responseFields: unknown): ReviewField[] {
  const values = new Map<string, unknown>();
  if (Array.isArray(responseFields)) {
    for (const item of responseFields) {
      if (!item || typeof item !== "object") continue;
      const candidate = item as AiResponseField;
      if (typeof candidate.id === "string") values.set(candidate.id, candidate.value);
    }
  }
  return fields.map((field) => ({ ...field, value: fieldValue(field, values.get(field.id)) }));
}

function jsonObjectText(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}

function parseAnalysisText(text: string | null, fields: NotionField[], providerName: string): ReviewField[] {
  if (!text) throw new Error(`${providerName} returned no analysis.`);
  try {
    const parsed = JSON.parse(jsonObjectText(text)) as { fields?: unknown };
    if (!Array.isArray(parsed.fields)) throw new Error("Missing fields array");
    return normalizeAiFields(fields, parsed.fields);
  } catch {
    throw new Error(`${providerName} returned an unreadable analysis. Try again.`);
  }
}

/** Parse a completed Responses API payload into the constrained local draft. */
export function parseOpenAiAnalysis(payload: OpenAiResponse, fields: NotionField[]): ReviewField[] {
  return parseAnalysisText(
    outputText(payload.output_text) ?? outputText(payload.output),
    fields,
    "OpenAI",
  );
}

/** Translate the approved local draft into Notion page property values. */
export function approvedNotionProperties(fields: ReviewField[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field.type) {
      case "rich_text":
        properties[field.id] = typeof field.value === "string" && field.value
          ? { rich_text: [{ type: "text", text: { content: field.value } }] }
          : { rich_text: [] };
        break;
      case "number":
        properties[field.id] = { number: typeof field.value === "number" ? field.value : null };
        break;
      case "checkbox":
        properties[field.id] = { checkbox: field.value === true };
        break;
      case "select":
        properties[field.id] = typeof field.value === "string" && field.value
          ? { select: { name: field.value } }
          : { select: null };
        break;
      case "multi_select":
        properties[field.id] = {
          multi_select: Array.isArray(field.value) ? field.value.map((name: string) => ({ name })) : [],
        };
        break;
      case "date":
        properties[field.id] = typeof field.value === "string" && field.value
          ? { date: { start: field.value } }
          : { date: null };
        break;
    }
  }
  return properties;
}

function analysisPrompt(page: PageMetadata, fields: NotionField[]): string {
  return JSON.stringify({
    task: "Extract only well-supported values from the web page for the supplied Notion fields.",
    rules: [
      "Return JSON only, with the shape { fields: [{ id, value }] }.",
      "Do not include Name or URL; the extension sets those itself.",
      "Use null when a scalar value is unknown and [] when a multi-select value is unknown.",
      "For select and multi-select fields with options, use the provided options exactly. If a field has no options, propose one concise new option and never include commas in option values.",
      "Do not infer facts that are not present in the page text.",
    ],
    page: { title: page.title, url: page.url, text: page.text },
    fields: fields.map(({ id, name, type, options }) => ({ id, name, type, options })),
  });
}

function boundedAnalysisInput(input: AnalyzeInput): Pick<AnalyzeInput, "page" | "fields"> {
  return {
    page: {
      title: input.page.title.slice(0, MAX_FIELD_NAME_LENGTH),
      url: input.page.url.slice(0, 2_000),
      text: input.page.text.slice(0, MAX_ANALYSIS_TEXT_LENGTH),
    },
    fields: input.fields.slice(0, MAX_ANALYSIS_FIELDS).map((field) => ({
      ...field,
      name: field.name.slice(0, MAX_FIELD_NAME_LENGTH),
      options: field.options
        .slice(0, MAX_FIELD_OPTIONS)
        .map((option) => option.slice(0, MAX_FIELD_OPTION_LENGTH)),
    })),
  };
}

function providerName(provider: ByokProvider): string {
  switch (provider) {
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
    case "openrouter":
      return "OpenRouter";
    case "gemini":
      return "Google Gemini";
  }
}

function aiError(provider: ByokProvider, status: number): string {
  const name = providerName(provider);
  if (status === 401 || status === 403) return `Your ${name} API key is not valid.`;
  if (status === 429) return `${name} is busy. Try analyzing again in a moment.`;
  return `${name} could not analyze this page.`;
}

async function responseError(provider: ByokProvider, response: Response): Promise<never> {
  throw new Error(aiError(provider, response.status));
}

interface AnalyzeInput {
  apiKey: string;
  page: PageMetadata;
  fields: NotionField[];
  fetcher?: Fetcher;
}

function request(input: AnalyzeInput, url: string, init: RequestInit): Promise<Response> {
  return (input.fetcher ?? fetch)(url, init);
}

export async function analyzeWithOpenAi(input: AnalyzeInput): Promise<ReviewField[]> {
  const analysis = boundedAnalysisInput(input);
  const response = await request(input, OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      input: analysisPrompt(analysis.page, analysis.fields),
      text: { format: { type: "json_object" } },
    }),
  });
  if (!response.ok) return responseError("openai", response);

  return parseOpenAiAnalysis((await response.json()) as OpenAiResponse, analysis.fields);
}

async function analyzeWithAnthropic(input: AnalyzeInput): Promise<ReviewField[]> {
  const analysis = boundedAnalysisInput(input);
  const response = await request(input, ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": input.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_ANALYSIS_MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: analysisPrompt(analysis.page, analysis.fields) }],
    }),
  });
  if (!response.ok) return responseError("anthropic", response);

  const payload = (await response.json()) as { content?: Array<{ type?: unknown; text?: unknown }> };
  const text = payload.content?.find((item) => item.type === "text" && typeof item.text === "string")?.text;
  return parseAnalysisText(typeof text === "string" ? text : null, analysis.fields, "Anthropic");
}

async function analyzeWithGemini(input: AnalyzeInput): Promise<ReviewField[]> {
  const analysis = boundedAnalysisInput(input);
  const response = await request(input, GEMINI_GENERATE_URL, {
    method: "POST",
    headers: { "x-goog-api-key": input.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: analysisPrompt(analysis.page, analysis.fields) }] }],
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!response.ok) return responseError("gemini", response);

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;
  return parseAnalysisText(typeof text === "string" ? text : null, analysis.fields, "Google Gemini");
}

async function analyzeWithOpenRouter(input: AnalyzeInput): Promise<ReviewField[]> {
  const analysis = boundedAnalysisInput(input);
  const response = await request(input, OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "X-OpenRouter-Title": "Notion Web Clipper",
    },
    body: JSON.stringify({
      model: OPENROUTER_FREE_MODEL,
      messages: [{ role: "user", content: analysisPrompt(analysis.page, analysis.fields) }],
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) return responseError("openrouter", response);

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const text = payload.choices?.[0]?.message?.content;
  return parseAnalysisText(typeof text === "string" ? text : null, analysis.fields, "OpenRouter");
}

export async function analyzeWithProvider({
  provider,
  ...input
}: AnalyzeInput & { provider: ByokProvider }): Promise<ReviewField[]> {
  switch (provider) {
    case "openai":
      return analyzeWithOpenAi(input);
    case "anthropic":
      return analyzeWithAnthropic(input);
    case "gemini":
      return analyzeWithGemini(input);
    case "openrouter":
      return analyzeWithOpenRouter(input);
  }
}
