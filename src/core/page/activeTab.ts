import type { PageMetadata } from "~/shared/pageMetadata";

interface ExtensionTab {
  id?: number;
}

interface ExtensionTabsApi {
  query(queryInfo: { active: boolean; currentWindow: boolean }): Promise<ExtensionTab[]>;
}

interface ExtensionScriptingApi {
  executeScript(
    injection:
      | { target: { tabId: number }; func: () => PageMetadata }
      | { target: { tabId: number }; files: string[] },
  ): Promise<Array<{ result?: unknown }>>;
}

interface ExtensionApi {
  tabs?: ExtensionTabsApi;
  scripting?: ExtensionScriptingApi;
}

function readPageMetadata(): PageMetadata {
  const maxTextLength = 60_000;
  const metaContent = (selector: string): string | null => {
    const content = document.querySelector<HTMLMetaElement>(selector)?.content.trim();
    return content || null;
  };
  const metadataTitle =
    metaContent('meta[property="og:title"]') ?? metaContent('meta[name="twitter:title"]');
  const title = metadataTitle || document.title.trim() || "Untitled page";

  return {
    title,
    url: window.location.href,
    text: (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, maxTextLength),
  };
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

/** Read page details on demand from the active browser tab. */
export async function getActivePageMetadata(useDefuddle = true): Promise<PageMetadata> {
  const extension = (globalThis as typeof globalThis & { chrome?: ExtensionApi }).chrome;
  if (!extension?.tabs || !extension.scripting) {
    throw new Error("Page details are only available inside the browser extension.");
  }

  const [tab] = await extension.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Could not identify the active browser tab.");

  try {
    const [injection] = await extension.scripting.executeScript(
      useDefuddle
        ? { target: { tabId: tab.id }, files: ["page-extractor.js"] }
        : { target: { tabId: tab.id }, func: readPageMetadata },
    );
    const metadata = pageMetadataFromResponse(injection?.result);
    if (!metadata) throw new Error("The active page did not return usable details.");
    return metadata;
  } catch {
    throw new Error("Notion Web Clipper cannot read this page. Open a regular website and try again.");
  }
}
