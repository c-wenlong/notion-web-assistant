import { getAuthStrategy } from "~/core/auth";
import { formatNotionError, type NotionErrorBody } from "./errors";
import { resolveDestinationSchema, type NotionPropertySchema } from "./schema";

export interface CreateClipInput {
  dataSourceId: string;
  title: string;
  url: string;
  properties?: Record<string, unknown>;
}

export interface CreatedNotionPage {
  pageUrl: string;
}

interface CreatePageResponse {
  url?: unknown;
}

interface DataSourceResponse {
  properties?: unknown;
}

const CREATE_PAGE_URL = "https://api.notion.com/v1/pages";
const MAX_TITLE_LENGTH = 2000;

function notionHeaders(token: string, version: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "Notion-Version": version,
  };
}

async function responseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => undefined) as NotionErrorBody | undefined;
  return formatNotionError(response.status, body);
}

function propertiesFromResponse(payload: DataSourceResponse): Record<string, NotionPropertySchema> {
  if (!payload.properties || typeof payload.properties !== "object") {
    throw new Error("Notion did not return the selected database's properties. Enable Read content and try again.");
  }
  return payload.properties as Record<string, NotionPropertySchema>;
}

async function destinationSchema(
  dataSourceId: string,
  token: string,
  version: string,
): Promise<{ titleKey: string; urlKey: string }> {
  const endpoint = `https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}`;
  const response = await fetch(endpoint, { headers: notionHeaders(token, version) });
  if (!response.ok) throw new Error(await responseError(response));

  const schema = resolveDestinationSchema(
    propertiesFromResponse((await response.json()) as DataSourceResponse),
  );
  if (!schema.needsUrlColumn) return schema;

  const updateResponse = await fetch(endpoint, {
    method: "PATCH",
    headers: notionHeaders(token, version),
    body: JSON.stringify({
      properties: { URL: { type: "url", url: {} } },
    }),
  });
  if (!updateResponse.ok) {
    const detail = await responseError(updateResponse);
    throw new Error(`Nova Clipper could not add the URL column. ${detail}`);
  }

  return schema;
}

/** Create a database row with the page title under Name and the current URL under URL. */
export async function createNotionClip({
  dataSourceId,
  title,
  url,
  properties = {},
}: CreateClipInput): Promise<CreatedNotionPage> {
  const auth = await getAuthStrategy();
  const token = await auth.getNotionToken();
  const version = auth.getNotionVersion();
  const schema = await destinationSchema(dataSourceId, token, version);
  const response = await fetch(CREATE_PAGE_URL, {
    method: "POST",
    headers: notionHeaders(token, version),
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: dataSourceId },
      properties: {
        ...properties,
        [schema.titleKey]: {
          title: [{ type: "text", text: { content: title.slice(0, MAX_TITLE_LENGTH) } }],
        },
        [schema.urlKey]: { url },
      },
    }),
  });

  if (!response.ok) throw new Error(await responseError(response));
  const payload = (await response.json()) as CreatePageResponse;
  if (typeof payload.url !== "string") {
    throw new Error("Notion created the clip but did not return its page URL.");
  }
  return { pageUrl: payload.url };
}
