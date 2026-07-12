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
  kind: "created" | "updated";
  pageUrl: string;
}

export interface DuplicateNotionPage {
  kind: "duplicate";
  pageId: string;
  pageUrl: string;
}

export type CreateNotionClipResult = CreatedNotionPage | DuplicateNotionPage;

interface CreatePageResponse {
  id?: unknown;
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
    throw new Error(`Notion Web Clipper could not add the URL column. ${detail}`);
  }

  return schema;
}

async function findDuplicateByUrl(
  dataSourceId: string,
  urlProperty: string,
  url: string,
  token: string,
  version: string,
): Promise<DuplicateNotionPage | null> {
  const endpoint = `https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: notionHeaders(token, version),
    body: JSON.stringify({
      filter: { property: urlProperty, url: { equals: url } },
      page_size: 1,
    }),
  });
  if (!response.ok) throw new Error(await responseError(response));

  const payload = (await response.json()) as { results?: unknown };
  const page = Array.isArray(payload.results) ? payload.results[0] : undefined;
  if (!page || typeof page !== "object") return null;
  const record = page as CreatePageResponse;
  if (typeof record.id !== "string" || typeof record.url !== "string") return null;
  return { kind: "duplicate", pageId: record.id, pageUrl: record.url };
}

/** Check the URL uniqueness rule before any paid AI processing begins. */
export async function findNotionClipDuplicate({
  dataSourceId,
  url,
}: Pick<CreateClipInput, "dataSourceId" | "url">): Promise<DuplicateNotionPage | null> {
  const auth = await getAuthStrategy();
  const token = await auth.getNotionToken();
  const version = auth.getNotionVersion();
  const schema = await destinationSchema(dataSourceId, token, version);
  return findDuplicateByUrl(dataSourceId, schema.urlKey, url, token, version);
}

function clipProperties(
  schema: { titleKey: string; urlKey: string },
  title: string,
  url: string,
  properties: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...properties,
    [schema.titleKey]: {
      title: [{ type: "text", text: { content: title.slice(0, MAX_TITLE_LENGTH) } }],
    },
    [schema.urlKey]: { url },
  };
}

function pageUrlFromResponse(payload: CreatePageResponse, action: string): string {
  if (typeof payload.url !== "string") {
    throw new Error(`Notion ${action} the clip but did not return its page URL.`);
  }
  return payload.url;
}

/** Create a database row with the page title under Name and the current URL under URL. */
export async function createNotionClip({
  dataSourceId,
  title,
  url,
  properties = {},
}: CreateClipInput): Promise<CreateNotionClipResult> {
  const auth = await getAuthStrategy();
  const token = await auth.getNotionToken();
  const version = auth.getNotionVersion();
  const schema = await destinationSchema(dataSourceId, token, version);
  const duplicate = await findDuplicateByUrl(dataSourceId, schema.urlKey, url, token, version);
  if (duplicate) return duplicate;
  const response = await fetch(CREATE_PAGE_URL, {
    method: "POST",
    headers: notionHeaders(token, version),
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: dataSourceId },
      properties: clipProperties(schema, title, url, properties),
    }),
  });

  if (!response.ok) throw new Error(await responseError(response));
  const payload = (await response.json()) as CreatePageResponse;
  return { kind: "created", pageUrl: pageUrlFromResponse(payload, "created") };
}

/** Replace the clip properties on a duplicate row after the user approves. */
export async function overwriteNotionClip(
  pageId: string,
  { dataSourceId, title, url, properties = {} }: CreateClipInput,
): Promise<CreatedNotionPage> {
  const auth = await getAuthStrategy();
  const token = await auth.getNotionToken();
  const version = auth.getNotionVersion();
  const schema = await destinationSchema(dataSourceId, token, version);
  const response = await fetch(`https://api.notion.com/v1/pages/${encodeURIComponent(pageId)}`, {
    method: "PATCH",
    headers: notionHeaders(token, version),
    body: JSON.stringify({ properties: clipProperties(schema, title, url, properties) }),
  });
  if (!response.ok) throw new Error(await responseError(response));

  const payload = (await response.json()) as CreatePageResponse;
  return { kind: "updated", pageUrl: pageUrlFromResponse(payload, "updated") };
}
