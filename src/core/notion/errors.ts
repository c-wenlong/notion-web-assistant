export interface NotionErrorBody {
  code?: unknown;
  message?: unknown;
}

/** Preserve Notion's specific validation message whenever it supplies one. */
export function formatNotionError(status: number, body?: NotionErrorBody): string {
  if (typeof body?.message === "string" && body.message.trim()) {
    return `Notion: ${body.message.trim()}`;
  }
  if (status === 400) return "Notion rejected the selected database schema.";
  if (status === 401) return "Your Notion integration secret is no longer valid.";
  if (status === 403) return "Notion denied this action. Check this integration's capabilities.";
  if (status === 429) return "Notion is busy. Try again in a moment.";
  return "Notion could not save this clip.";
}
