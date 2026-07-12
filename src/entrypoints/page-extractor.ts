import { defineUnlistedScript } from "#imports";
import { extractPageText } from "~/core/page/extraction";
import type { PageMetadata } from "~/shared/pageMetadata";

export default defineUnlistedScript((): PageMetadata => {
  const metaContent = (selector: string): string | null => {
    const content = document.querySelector<HTMLMetaElement>(selector)?.content.trim();
    return content || null;
  };
  const metadataTitle =
    metaContent('meta[property="og:title"]') ?? metaContent('meta[name="twitter:title"]');

  return {
    title: metadataTitle || document.title.trim() || "Untitled page",
    url: window.location.href,
    text: extractPageText(document, window.location.href),
  };
});
