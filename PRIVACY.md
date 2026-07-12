# Privacy Policy for Notion Web Clipper

**Effective date:** July 11, 2026
**Last updated:** July 11, 2026

Notion Web Clipper is a browser extension whose single purpose is to let a user save the webpage they are viewing to a Notion database, either as a title-and-URL Quick Clip or as a user-reviewed Smart Clip with AI-prepared database fields.

## Data the extension handles

Notion Web Clipper handles the minimum data needed to provide its clipping features:

- **Authentication information:** the Notion internal integration secret and API key for the AI provider selected by the user.
- **Webpage information:** the URL and title of the active page when the user opens the extension.
- **Website content:** text extracted from the active page for Smart Clip. Local Defuddle extraction may remove navigation, advertisements, and other boilerplate before analysis.
- **Notion workspace information:** names, identifiers, schemas, property types, and property options for databases shared with the user's Notion integration, plus matching rows needed for URL duplicate detection.
- **Extension preferences:** onboarding status, selected AI provider, last selected Notion database, content-extraction preference, and appearance preference.

The extension does not collect browsing history in the background, monitor user activity, serve advertising, or use analytics. Page information is accessed only after the user invokes the extension on that page.

## How data is used and transferred

Data is used only to provide the user-requested clipping functionality:

- **Notion:** The extension sends the user's Notion integration secret to the Notion API for authentication. It retrieves databases shared with that integration, reads their schemas, checks the active page URL for duplicates, and sends the title, URL, and user-approved field values when creating or updating a Notion page.
- **AI providers:** Smart Clip sends the active page title, URL, up to 60,000 characters of extracted page text, and compatible Notion field names, types, and options to the AI provider selected by the user: OpenAI, Anthropic, Google Gemini, or OpenRouter. The corresponding user-provided API key authenticates that request. The user reviews generated values before they are written to Notion.
- **Quick Clip:** Quick Clip sends the page title and URL to Notion and does not send page text to an AI provider.
- **Connection checks:** When the user verifies a saved credential, the extension sends that credential only to the corresponding Notion or AI-provider API.

All API requests are made directly from the extension over HTTPS. Notion Web Clipper has no developer-operated backend and the developer does not receive or store page content, credentials, Notion data, or AI responses. Data sent to Notion or an AI provider is also subject to that provider's terms and privacy policy.

## Local storage and retention

Notion and AI-provider credentials are stored in `chrome.storage.local` on the user's browser profile. Non-sensitive preferences may be stored in `chrome.storage.sync` so Chrome can synchronize them for the user. Credentials remain until the user disconnects or replaces them, clears the extension's storage, or uninstalls the extension. The extension does not maintain a separate developer-controlled copy.

Clips saved to Notion remain in the user's Notion workspace until the user changes or deletes them. Retention of information sent to Notion or an AI provider is controlled by the user's relationship with that provider and the provider's applicable policies.

## User choices and deletion

Users choose which Notion databases to share with their integration, which database receives each clip, whether to use Quick Clip or Smart Clip, which AI provider to use, and whether local Defuddle extraction is enabled. Users can disconnect Notion in Settings. Uninstalling the extension removes its locally stored extension data from Chrome; users may also clear extension data through Chrome. Information already saved to Notion or processed by an AI provider must be managed through that service.

## Data sale, advertising, and human access

The developer does not sell user data, use it for advertising, use it to determine creditworthiness, or allow humans to read it. Data is transferred only as necessary to provide the clipping feature requested by the user, comply with applicable law, or protect against security threats.

Notion Web Clipper's use and transfer of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Security

The extension requests only the browser permissions needed for its single purpose. It uses temporary `activeTab` access and on-demand script execution instead of persistent access to every website. API communication uses HTTPS. Credentials are not included in source code, logs, or the extension package.

## Changes to this policy

This policy may be updated when the extension's data practices change. The effective date and last-updated date above will be revised, and Chrome Web Store disclosures will be kept consistent with the current extension behavior.

## Contact

Questions about this policy may be submitted through the [Notion Web Clipper issue tracker](https://github.com/c-wenlong/notion-web-assistant/issues). Do not include API keys, integration secrets, private page content, or other sensitive data in a public issue. For security reports, follow the private reporting guidance in [SECURITY.md](SECURITY.md).
