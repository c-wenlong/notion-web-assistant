import { formatNotionError, type NotionErrorBody } from "./errors";
import {
  resolveDestinationSchema,
  type DestinationSchema,
  type NotionPropertySchema,
} from "./schema";

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

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export interface NotionApiClient {
  token: string;
  version: string;
  fetcher?: Fetcher;
}

export class DuplicateNotionClipChangedError extends Error {
  constructor() {
    super("The matching Notion row changed. Review the duplicate before overwriting it.");
    this.name = "DuplicateNotionClipChangedError";
  }
}

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

function request(client: NotionApiClient, url: string, init: RequestInit): Promise<Response> {
  return (client.fetcher ?? fetch)(url, init);
}

async function destinationSchema(
  dataSourceId: string,
  client: NotionApiClient,
): Promise<DestinationSchema> {
  const endpoint = `https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}`;
  const response = await request(client, endpoint, { headers: notionHeaders(client.token, client.version) });
  if (!response.ok) throw new Error(await responseError(response));

  return resolveDestinationSchema(
    propertiesFromResponse((await response.json()) as DataSourceResponse),
  );
}

async function ensureUrlColumn(
  dataSourceId: string,
  schema: DestinationSchema,
  client: NotionApiClient,
): Promise<DestinationSchema> {
  if (!schema.needsUrlColumn) return schema;

  const endpoint = `https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}`;
  const updateResponse = await request(client, endpoint, {
    method: "PATCH",
    headers: notionHeaders(client.token, client.version),
    body: JSON.stringify({
      properties: { URL: { type: "url", url: {} } },
    }),
  });
  if (!updateResponse.ok) {
    const detail = await responseError(updateResponse);
    throw new Error(`Notion Web Clipper could not add the URL column. ${detail}`);
  }

  return { ...schema, needsUrlColumn: false };
}

async function findDuplicateByUrl(
  dataSourceId: string,
  urlProperty: string,
  url: string,
  client: NotionApiClient,
): Promise<DuplicateNotionPage | null> {
  const endpoint = `https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`;
  const response = await request(client, endpoint, {
    method: "POST",
    headers: notionHeaders(client.token, client.version),
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

/** Check the URL uniqueness rule without changing the selected database. */
export async function findNotionClipDuplicateWithClient(
  { dataSourceId, url }: Pick<CreateClipInput, "dataSourceId" | "url">,
  client: NotionApiClient,
): Promise<DuplicateNotionPage | null> {
  const schema = await destinationSchema(dataSourceId, client);
  if (schema.needsUrlColumn) return null;
  return findDuplicateByUrl(dataSourceId, schema.urlKey, url, client);
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

/** Create a Notion clip using an injected client. */
export async function createNotionClipWithClient({
  dataSourceId,
  title,
  url,
  properties = {},
}: CreateClipInput, client: NotionApiClient): Promise<CreateNotionClipResult> {
  const schema = await ensureUrlColumn(
    dataSourceId,
    await destinationSchema(dataSourceId, client),
    client,
  );
  const duplicate = await findDuplicateByUrl(dataSourceId, schema.urlKey, url, client);
  if (duplicate) return duplicate;
  const response = await request(client, CREATE_PAGE_URL, {
    method: "POST",
    headers: notionHeaders(client.token, client.version),
    body: JSON.stringify({
      parent: { type: "data_source_id", data_source_id: dataSourceId },
      properties: clipProperties(schema, title, url, properties),
    }),
  });

  if (!response.ok) throw new Error(await responseError(response));
  const payload = (await response.json()) as CreatePageResponse;
  return { kind: "created", pageUrl: pageUrlFromResponse(payload, "created") };
}

/** Replace a duplicate only when it still matches the URL selected for approval. */
export async function overwriteNotionClipWithClient(
  pageId: string,
  { dataSourceId, title, url, properties = {} }: CreateClipInput,
  client: NotionApiClient,
): Promise<CreatedNotionPage> {
  const schema = await ensureUrlColumn(
    dataSourceId,
    await destinationSchema(dataSourceId, client),
    client,
  );
  const duplicate = await findDuplicateByUrl(dataSourceId, schema.urlKey, url, client);
  if (duplicate?.pageId !== pageId) throw new DuplicateNotionClipChangedError();

  const response = await request(client, `https://api.notion.com/v1/pages/${encodeURIComponent(pageId)}`, {
    method: "PATCH",
    headers: notionHeaders(client.token, client.version),
    body: JSON.stringify({ properties: clipProperties(schema, title, url, properties) }),
  });
  if (!response.ok) throw new Error(await responseError(response));

  const payload = (await response.json()) as CreatePageResponse;
  return { kind: "updated", pageUrl: pageUrlFromResponse(payload, "updated") };
}
