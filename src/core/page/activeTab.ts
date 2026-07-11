import {
  PAGE_METADATA_MESSAGE,
  type PageMetadata,
  type PageMetadataRequest,
} from "~/shared/pageMetadata";

interface ExtensionTab {
  id?: number;
}

interface ExtensionTabsApi {
  query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<ExtensionTab[]>;
  sendMessage(tabId: number, message: PageMetadataRequest): Promise<unknown>;
}

interface ExtensionApi {
  tabs?: ExtensionTabsApi;
}

function pageMetadataFromResponse(value: unknown): PageMetadata | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<PageMetadata>;
  if (
    typeof candidate.title !== "string" ||
    typeof candidate.url !== "string" ||
    typeof candidate.text !== "string"
  ) {
    return null;
  }
  return { title: candidate.title, url: candidate.url, text: candidate.text };
}

/** Read title and URL from the content script attached to the active browser tab. */
export async function getActivePageMetadata(): Promise<PageMetadata> {
  const extension = (globalThis as typeof globalThis & { chrome?: ExtensionApi }).chrome;
  if (!extension?.tabs) {
    throw new Error("Page details are only available inside the browser extension.");
  }

  const [tab] = await extension.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Could not identify the active browser tab.");

  try {
    const response = await extension.tabs.sendMessage(tab.id, {
      type: PAGE_METADATA_MESSAGE,
    });
    const metadata = pageMetadataFromResponse(response);
    if (!metadata) throw new Error("The active page did not return usable details.");
    return metadata;
  } catch {
    throw new Error("Notion Web Clipper cannot read this page. Open a regular website and try again.");
  }
}
