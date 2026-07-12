import Defuddle from "defuddle";

export const MAX_PAGE_TEXT_LENGTH = 60_000;

export function originalPageText(document: Document): string {
  return (document.body?.innerText ?? document.body?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PAGE_TEXT_LENGTH);
}

export function extractPageText(document: Document, url: string): string {
  const fallback = originalPageText(document);

  try {
    const result = new Defuddle(document, {
      url,
      markdown: true,
      useAsync: false,
    }).parse();
    const extracted = result.content
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_PAGE_TEXT_LENGTH);

    return extracted || fallback;
  } catch {
    return fallback;
  }
}
