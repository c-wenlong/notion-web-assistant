import type { ByokProvider } from "~/storage/items";

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

interface ConnectionRequest {
  url: string;
  init: RequestInit;
}

function connectionRequest(provider: ByokProvider, apiKey: string): ConnectionRequest {
  switch (provider) {
    case "openai":
      return {
        url: "https://api.openai.com/v1/models",
        init: { headers: { Authorization: `Bearer ${apiKey}` } },
      };
    case "anthropic":
      return {
        url: "https://api.anthropic.com/v1/models",
        init: {
          headers: {
            "anthropic-version": "2023-06-01",
            "x-api-key": apiKey,
          },
        },
      };
    case "openrouter":
      return {
        url: "https://openrouter.ai/api/v1/auth/key",
        init: { headers: { Authorization: `Bearer ${apiKey}` } },
      };
    case "gemini":
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        init: {},
      };
  }
}

function connectionError(provider: ByokProvider, status: number): string {
  const name = provider === "openai" ? "OpenAI" : provider === "openrouter" ? "OpenRouter" : provider === "gemini" ? "Gemini" : "Anthropic";
  if (status === 401 || status === 403) return `${name} did not accept that API key.`;
  if (status === 429) return `${name} is busy. Try checking the connection again in a moment.`;
  return `${name} could not verify that API key.`;
}

/** Verify a cloud provider key with a read-only endpoint before persisting it. */
export async function validateAiProvider(
  provider: ByokProvider,
  apiKey: string,
  fetcher: Fetcher = fetch,
): Promise<void> {
  if (!apiKey.trim()) throw new Error("Paste an API key before checking the connection.");

  const request = connectionRequest(provider, apiKey.trim());
  const response = await fetcher(request.url, request.init);
  if (!response.ok) throw new Error(connectionError(provider, response.status));
}
