# Changelog

All notable changes to Notion Web Clipper are documented in this file.

The project follows [Semantic Versioning](https://semver.org/).

## [1.0.3] - 2026-07-19

### Added

- Smart Clip now sends each Notion column's description to the AI provider and shows it as hint text in the review draft, so field values better match the column's intent.

## [1.0.2] - 2026-07-11

### Fixed

- Ignored Responses API reasoning metadata when locating OpenAI's structured Smart Clip answer.

## [1.0.1] - 2026-07-11

### Added

- Default-on local Defuddle extraction with a Settings toggle for restoring the original page-text method.

### Fixed

- Prevented OpenAI Smart Clip from returning unreadable drafts by enforcing the expected field structure with Structured Outputs.

## [1.0.0] - 2026-07-11

### Added

- Smart Clip adapters for Anthropic and Google Gemini.
- OpenRouter Smart Clip support through its `openrouter/free` router, with a visible Free label and API-key requirement.
- URL-based duplicate detection with a cancel-or-overwrite confirmation before a Notion write.
- First public release of the Notion Web Clipper Chrome extension.
- Onboarding and popup settings for the Notion integration, AI provider, and appearance.
- Database discovery from the connected Notion integration.
- `Quick Clip` for title-and-URL captures.
- `Smart Clip` for AI-assisted field preparation with an approval screen.
- Automatic `URL` property creation for compatible Notion databases.
- Light, dark, and system appearance modes.
- Chrome extension mascot and manifest icons.
- CI verification and a downloadable Chrome MV3 build artifact.

### Changed

- Removed the non-functional Chrome Nano provider option and migrated any saved Nano choice to OpenAI.
- Removed persistent all-sites content-script injection and unused host permissions.
- Bound Smart Clip input, revalidated duplicate overwrites, and made the URL-column write occur only after a user approves a save.
- Updated WXT to 0.20.27 and pinned patched development dependencies.

### Security

- Restricted local credential storage to trusted extension contexts.
- Added a full dependency audit and immutable GitHub Action pins to CI.
