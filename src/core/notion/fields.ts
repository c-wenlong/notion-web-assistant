import { getAuthStrategy } from "~/core/auth";
import { formatNotionError, type NotionErrorBody } from "./errors";

export const AI_FIELD_TYPES = [
  "rich_text",
  "number",
  "checkbox",
  "select",
  "multi_select",
  "date",
] as const;

export type AiFieldType = (typeof AI_FIELD_TYPES)[number];

export interface NotionField {
  id: string;
  name: string;
  type: AiFieldType;
  options: string[];
  description: string;
}

interface DataSourceResponse {
  properties?: unknown;
}

interface RawProperty {
  id?: unknown;
  description?: unknown;
  type?: unknown;
  select?: { options?: unknown };
  multi_select?: { options?: unknown };
}

function optionNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) => {
    if (!option || typeof option !== "object") return [];
    const name = (option as { name?: unknown }).name;
    return typeof name === "string" ? [name] : [];
  });
}

function readableError(status: number, body?: NotionErrorBody): string {
  return formatNotionError(status, body);
}

/** Return fields that the review flow can safely ask the AI to populate. */
export async function getAiFields(dataSourceId: string): Promise<NotionField[]> {
  const auth = await getAuthStrategy();
  const token = await auth.getNotionToken();
  const response = await fetch(
    `https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": auth.getNotionVersion(),
      },
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as NotionErrorBody | undefined;
    throw new Error(readableError(response.status, body));
  }

  const payload = (await response.json()) as DataSourceResponse;
  if (!payload.properties || typeof payload.properties !== "object") {
    throw new Error("Notion did not return the selected database's field schema.");
  }

  return Object.entries(payload.properties as Record<string, RawProperty>)
    .flatMap(([name, property]) => {
      if (!AI_FIELD_TYPES.includes(property.type as AiFieldType)) return [];
      if (typeof property.id !== "string") return [];
      const type = property.type as AiFieldType;
      const options = type === "select"
        ? optionNames(property.select?.options)
        : type === "multi_select"
          ? optionNames(property.multi_select?.options)
          : [];
      const description = typeof property.description === "string" ? property.description.trim() : "";
      return [{ id: property.id, name, type, options, description }];
    });
}
