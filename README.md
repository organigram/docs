# Organigram Docs

This package contains the MDX source files, code examples, and documentation generation scripts for the official [Organigram.ai documentation](https://organigram.ai/en/docs).

It is consumed by the Organigram web application, which renders the MDX pages and generates the app-specific docs module map.

## Contents

- `mdx/`: documentation pages.
- `code-examples/`: snippets imported by MDX pages and rendered with Code Hike.
- `scripts/generateRestApiDocs.ts`: generates the REST API reference from metadata exported by the web application API routes.

## Development

Generate the REST API reference:

```bash
pnpm docs:generate
```

Check links in the MDX documentation:

```bash
pnpm linkcheck
```

## Contributing

Documentation changes should usually be made in `mdx/`. When adding code snippets, place reusable examples in `code-examples/` and include them from MDX with Code Hike's `// from ...` annotation.
