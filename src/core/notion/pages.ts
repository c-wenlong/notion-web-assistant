import { getAuthStrategy } from "~/core/auth";
import {
  createNotionClipWithClient,
  findNotionClipDuplicateWithClient,
  overwriteNotionClipWithClient,
  type CreateClipInput,
  type CreatedNotionPage,
  type CreateNotionClipResult,
  type DuplicateNotionPage,
  type NotionApiClient,
} from "./pageClient";

export * from "./pageClient";

async function authenticatedClient(): Promise<NotionApiClient> {
  const auth = await getAuthStrategy();
  return {
    token: await auth.getNotionToken(),
    version: auth.getNotionVersion(),
  };
}

/** Check the URL uniqueness rule before any paid AI processing begins. */
export async function findNotionClipDuplicate(
  input: Pick<CreateClipInput, "dataSourceId" | "url">,
): Promise<DuplicateNotionPage | null> {
  return findNotionClipDuplicateWithClient(input, await authenticatedClient());
}

/** Create a database row with the page title under Name and the current URL under URL. */
export async function createNotionClip(input: CreateClipInput): Promise<CreateNotionClipResult> {
  return createNotionClipWithClient(input, await authenticatedClient());
}

/** Replace the clip properties on a duplicate row after the user approves. */
export async function overwriteNotionClip(
  pageId: string,
  input: CreateClipInput,
): Promise<CreatedNotionPage> {
  return overwriteNotionClipWithClient(pageId, input, await authenticatedClient());
}
