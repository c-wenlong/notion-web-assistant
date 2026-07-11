import { getAuthStrategy } from "~/core/auth";

export interface NotionDataSource {
  id: string;
  name: string;
}

interface SearchResponse {
  has_more: boolean;
  next_cursor: string | null;
  results: unknown[];
}

interface SearchResult {
  object?: unknown;
  id?: unknown;
  name?: unknown;
  title?: unknown;
}

interface RichTextPart {
  plain_text?: unknown;
}

const SEARCH_URL = "https://api.notion.com/v1/search";
const PAGE_SIZE = 100;

function titleText(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const text = value
    .map((part) => {
      if (!part || typeof part !== "object") return "";
      const plainText = (part as RichTextPart).plain_text;
      return typeof plainText === "string" ? plainText : "";
    })
    .join("")
    .trim();
  return text || null;
}

function dataSourceFromSearchResult(value: unknown): NotionDataSource | null {
  if (!value || typeof value !== "object") return null;
  const result = value as SearchResult;
  if (result.object !== "data_source" || typeof result.id !== "string") return null;

  const name =
    (typeof result.name === "string" && result.name.trim()) ||
    titleText(result.title) ||
    "Untitled database";

  return { id: result.id, name };
}

function responseError(status: number): string {
  if (status === 401) return "Your Notion integration secret is no longer valid.";
  if (status === 403) return "Enable Read content for this integration in Notion.";
  if (status === 429) return "Notion is busy. Try again in a moment.";
  return "Could not load your Notion databases.";
}

/**
 * Return every data source shared with the current Notion integration.
 * Notion uses data-source IDs for writes from API version 2025-09-03 onward;
 * these correspond to the databases a user sees in the Notion app.
 */
export async function listNotionDataSources(): Promise<NotionDataSource[]> {
  const auth = await getAuthStrategy();
  const token = await auth.getNotionToken();
  const sources: NotionDataSource[] = [];
  let cursor: string | null = null;

  do {
    const body: {
      page_size: number;
      filter: { property: "object"; value: "data_source" };
      start_cursor?: string;
    } = {
      page_size: PAGE_SIZE,
      filter: { property: "object", value: "data_source" },
    };
    if (cursor) body.start_cursor = cursor;

    const response = await fetch(SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": auth.getNotionVersion(),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(responseError(response.status));

    const payload = (await response.json()) as SearchResponse;
    for (const result of payload.results) {
      const source = dataSourceFromSearchResult(result);
      if (source) sources.push(source);
    }
    cursor = payload.has_more ? payload.next_cursor : null;
  } while (cursor);

  return sources.sort((left, right) => left.name.localeCompare(right.name));
}
