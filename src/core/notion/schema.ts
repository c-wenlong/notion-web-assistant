export interface NotionPropertySchema {
  id?: unknown;
  type?: unknown;
}

export interface DestinationSchema {
  titleKey: string;
  urlKey: string;
  needsUrlColumn: boolean;
}

function propertyKey(name: string, property: NotionPropertySchema): string {
  return typeof property.id === "string" && property.id ? property.id : name;
}

/**
 * Resolve the actual property IDs in a data source. Name is the default title
 * label in Notion, but integrations must use the title property's real ID so
 * renamed title columns still work. An existing URL-type column is reused.
 */
export function resolveDestinationSchema(
  properties: Record<string, NotionPropertySchema>,
): DestinationSchema {
  const entries = Object.entries(properties);
  const titleEntry = entries.find(([, property]) => property.type === "title");
  if (!titleEntry) {
    throw new Error("The selected database has no title column for the page name.");
  }

  const namedUrl = properties.URL;
  if (namedUrl && namedUrl.type !== "url") {
    throw new Error("This database already has a URL column, but it is not a URL-type property.");
  }
  const urlEntry = namedUrl?.type === "url"
    ? (["URL", namedUrl] as const)
    : entries.find(([, property]) => property.type === "url");

  return {
    titleKey: propertyKey(titleEntry[0], titleEntry[1]),
    urlKey: urlEntry ? propertyKey(urlEntry[0], urlEntry[1]) : "URL",
    needsUrlColumn: !urlEntry,
  };
}
