# Changelog

All notable changes to Notion Web Clipper are documented in this file.

The project follows [Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- Smart Clip adapters for Anthropic and Google Gemini.
- OpenRouter Smart Clip support through its `openrouter/free` router, with a visible Free label and API-key requirement.
- URL-based duplicate detection with a cancel-or-overwrite confirmation before a Notion write.

### Changed

- Removed the non-functional Chrome Nano provider option and migrated any saved Nano choice to OpenAI.

## [0.1.0] - 2026-07-11

### Added

- First beta release of the Notion Web Clipper Chrome extension.
- Onboarding and popup settings for the Notion integration, AI provider, privacy, and appearance.
- Database discovery from the connected Notion integration.
- `Quick Clip` for title-and-URL captures.
- `Smart Clip` for AI-assisted field preparation with an approval screen.
- Automatic `URL` property creation for compatible Notion databases.
- Light, dark, and system appearance modes.
- Chrome extension mascot and manifest icons.
- CI verification and a downloadable Chrome MV3 build artifact.

### Notes

- OAuth and automatic Chrome Web Store deployment are not part of this beta.
- Smart Clip supports the configured cloud provider for page analysis.
