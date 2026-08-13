# Contributing

## Prerequisites

- **Node 24** — the version is pinned in [`.nvmrc`](.nvmrc); `nvm use` (or your version manager's equivalent) picks it up. Installs fail on older Node because `engine-strict` is on.
- **pnpm 11** — the exact version is pinned in the `packageManager` field of [`package.json`](package.json), so `corepack enable` is all you need.

## Getting started

```bash
pnpm install     # installs the workspace and sets up git hooks (lefthook)
pnpm dev         # launches Electron; the renderer dev server prefers :5174 (next free port if busy — see the startup log)
```

## Before you push

```bash
pnpm check
```

That runs lint, format check, typecheck, tests, and build — **exactly what CI runs**. If it passes locally, CI passes.

Git hooks are installed automatically on `pnpm install` (see [`lefthook.yml`](lefthook.yml)): pre-commit formats staged files with oxfmt and lints them with oxlint. Don't fight the formatter — there are no style debates here, `oxfmt` is the authority.

## Conventions

- Tests live in the root [`tests/`](tests/) directory and run with `pnpm test`.
- Named exports only; kebab-case filenames (both enforced by lint).
- Shared versions live in the `catalog:` section of [`pnpm-workspace.yaml`](pnpm-workspace.yaml) — bump them there, not in individual manifests.

## Pull requests

Keep PRs focused on one change. Fill in the PR template, including how you tested. CI must be green before review.
