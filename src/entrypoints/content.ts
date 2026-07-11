import { defineContentScript } from "wxt/sandbox";
import {
  PAGE_METADATA_MESSAGE,
  type PageMetadata,
  type PageMetadataRequest,
} from "~/shared/pageMetadata";

function metaContent(selector: string): string | null {
  const content = document.querySelector<HTMLMetaElement>(selector)?.content.trim();
  return content || null;
}

function currentPageMetadata(): PageMetadata {
  const metadataTitle =
    metaContent('meta[property="og:title"]') ??
    metaContent('meta[name="twitter:title"]');
  const title = metadataTitle || document.title.trim() || "Untitled page";

  return {
    title: title || "Untitled page",
    url: window.location.href,
    text: (document.body?.innerText ?? "").replace(/\s+/g, " ").trim(),
  };
}

export default defineContentScript({
  matches: ["<all_urls>"],
  // `document_idle` matches the popup's expectations — the DOM is fully laid
  // out before metadata is read.
  runAt: "document_idle",
  main() {
    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      const request = message as Partial<PageMetadataRequest>;
      if (request.type !== PAGE_METADATA_MESSAGE) return;
      sendResponse(currentPageMetadata());
    });
  },
});
