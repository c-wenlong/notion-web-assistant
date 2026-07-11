import type { NotionField } from "~/core/notion/fields";
import type { PageMetadata } from "~/shared/pageMetadata";

export type DraftValue = string | number | boolean | string[] | null;

export interface ReviewField extends NotionField {
  value: DraftValue;
}

export interface OpenAiResponse {
  output_text?: unknown;
  output?: unknown;
}

interface AiResponseField {
  id?: unknown;
  value?: unknown;
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const ANALYSIS_MODEL = "gpt-5.4-mini";
const MAX_RICH_TEXT_LENGTH = 2000;

function outputText(value: unknown): string | null {
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

/** Parse a completed Responses API payload into the constrained local draft. */
export function parseOpenAiAnalysis(payload: OpenAiResponse, fields: NotionField[]): ReviewField[] {
  const text = outputText(payload.output_text) ?? outputText(payload.output);
  if (!text) throw new Error("OpenAI returned no analysis.");
  try {
    const parsed = JSON.parse(jsonObjectText(text)) as { fields?: unknown };
    if (!Array.isArray(parsed.fields)) throw new Error("Missing fields array");
    return normalizeAiFields(fields, parsed.fields);
  } catch {
    throw new Error("OpenAI returned an unreadable analysis. Try again.");
  }
}

/** Translate the approved local draft into Notion page property values. */
export function approvedNotionProperties(fields: ReviewField[]): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field.type) {
      case "rich_text":
        if (typeof field.value === "string" && field.value) {
          properties[field.id] = { rich_text: [{ type: "text", text: { content: field.value } }] };
        }
        break;
      case "number":
        if (typeof field.value === "number") properties[field.id] = { number: field.value };
        break;
      case "checkbox":
        if (typeof field.value === "boolean") properties[field.id] = { checkbox: field.value };
        break;
      case "select":
        if (typeof field.value === "string" && field.value) properties[field.id] = { select: { name: field.value } };
        break;
      case "multi_select":
        if (Array.isArray(field.value) && field.value.length) {
          properties[field.id] = { multi_select: field.value.map((name: string) => ({ name })) };
        }
        break;
      case "date":
        if (typeof field.value === "string" && field.value) properties[field.id] = { date: { start: field.value } };
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

function aiError(status: number): string {
  if (status === 401) return "Your OpenAI API key is not valid.";
  if (status === 429) return "OpenAI is busy. Try analyzing again in a moment.";
  return "OpenAI could not analyze this page.";
}

export async function analyzeWithOpenAi({
  apiKey,
  page,
  fields,
}: {
  apiKey: string;
  page: PageMetadata;
  fields: NotionField[];
}): Promise<ReviewField[]> {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ANALYSIS_MODEL,
      input: analysisPrompt(page, fields),
      text: { format: { type: "json_object" } },
    }),
  });
  if (!response.ok) throw new Error(aiError(response.status));

  return parseOpenAiAnalysis((await response.json()) as OpenAiResponse, fields);
}
