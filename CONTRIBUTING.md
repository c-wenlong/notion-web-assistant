# Contributing

Thanks for helping improve Notion Web Clipper.

## Local setup

Use Node.js 22 and pnpm 11.7.0 or later.

```bash
corepack enable
pnpm install
pnpm verify
```

`pnpm verify` is the same quality gate used in CI: it runs the Node test suite, TypeScript checks, the Chrome production build, and the standalone UI-preview build.

## Development workflow

1. Create a focused branch from `main`.
2. Make the smallest change that solves the issue.
3. Add or update tests when behavior changes.
4. Run `pnpm verify`.
5. Rebuild the extension with `pnpm build`, reload it from `chrome://extensions`, and test the affected popup flow.
6. Open a pull request describing user-visible changes, testing, and any privacy or permission impact.

## Guidelines

- Keep Notion and AI credentials out of source control.
- Preserve the title-and-URL baseline for all clipping paths.
- Send page content to an AI provider only after the user explicitly starts Smart Clip.
- Keep user-facing wording clear about what has and has not been saved to Notion.
- Do not hand-edit generated output under `.output/`, `.wxt/`, or `dist/`.

## Reporting bugs

For ordinary bugs and feature requests, use GitHub Issues. For a potential security issue, follow [SECURITY.md](SECURITY.md) instead.
