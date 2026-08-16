# Contributing

## Prerequisites

- **Node 24** — the version is pinned in [`.nvmrc`](.nvmrc); `nvm use` (or your version manager's equivalent) picks it up. Installs fail on older Node because `engine-strict` is on.
- **pnpm 11** — the exact version is pinned in the `packageManager` field of [`package.json`](package.json), so `corepack enable` is all you need.

## Getting started

```bash
pnpm install     # installs the workspace and sets up git hooks (lefthook)
pnpm dev         # launches Electron; the renderer dev server prefers :5174 (next free port if busy — see the startup log)
```

The first `pnpm dev` in a fresh checkout downloads the Electron binary, which `pnpm install` no longer does — Electron 43 fetches it on first use instead of from a postinstall script. If something launches Electron without going through `pnpm dev` and dies with `Error: Electron uninstall`, that download is what is missing:

```bash
pnpm --dir apps/desktop exec install-electron
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

## Repo layout

```
apps/
  desktop/      Electron shell: electron-vite + electron-builder. Mounts @umber/ui and nothing else.
packages/
  ui/           The actual application UI: every screen, plus the Tailwind theme.
  brand/        Umber's logo assets, and the only place to get them from.
  tsconfig/     Shared TypeScript configs (strict; see base.json).
tests/          All tests live here (Vitest + jsdom), run from the repo root.
```

The shell and the UI are **deliberately separate**: `apps/desktop` owns windows, processes and the preload bridge, and `packages/ui` owns everything a user sees. Nothing in `packages/ui` may import from `apps/`. That boundary is what keeps the UI portable to another shell later.

`packages/brand` holds the marks once, for everything that needs them: the header lockup, the installed app's icon and whatever comes next. The SVGs in `brand/assets` are the source of truth. `src/index.ts` only points at them, so nothing ever re-draws a logo and no copy can drift. Add a mark by dropping the file in and exporting it there.

## Commands

| Command                                | What it does                                     |
| -------------------------------------- | ------------------------------------------------ |
| `pnpm dev`                             | Start the app in watch mode                      |
| `pnpm build`                           | Build all packages (Turborepo, cached)           |
| `pnpm test` / `pnpm test:watch`        | Run the test suite in `tests/`                   |
| `pnpm typecheck`                       | Root `tsc` + per-package typecheck               |
| `pnpm lint` / `pnpm lint:fix`          | oxlint (warnings are errors)                     |
| `pnpm format` / `pnpm format:check`    | oxfmt                                            |
| `pnpm check`                           | Everything CI runs, in order. Run before pushing |
| `pnpm clean`                           | Delete build output and caches                   |
| `pnpm --filter @umber/desktop package` | Unpacked desktop build (no installer)            |
| `pnpm --filter @umber/desktop release` | Full desktop installers via electron-builder     |
| `pnpm --filter @umber/desktop start`   | Preview the built desktop app                    |

## Tooling decisions

- **pnpm catalogs.** Versions shared by multiple packages live once in the `catalog:` section of `pnpm-workspace.yaml`. Bump there, not in individual manifests.
- **Turborepo.** Caches `build` and `typecheck` per package. `test`, `lint` and `format` are deliberately root-only scripts (one Vitest run, one oxlint run over the whole repo) and are not turbo tasks.
- **oxlint + oxfmt.** No ESLint/Prettier. VS Code is pre-configured to use the oxc extension (`.vscode/`); other editors get `.editorconfig`. Pre-commit hooks (lefthook) run both on staged files.
- **Tailwind CSS 4, CSS-first.** No `tailwind.config.*`. The theme, the `glass` utilities and the canvas live in `packages/ui/src/styles.css`; the app's entry CSS declares its own `@source` so the UI package never references app paths.
- **TanStack Router.** Routes are defined in code (`packages/ui/src/router.tsx`), not by file convention, because the UI package is a library rather than a route directory. History is hash-based so routing survives the packaged `file://` renderer.
- **Strict TypeScript.** All packages extend `packages/tsconfig/base.json` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, ...).
- **Desktop dependency layout.** `apps/desktop` keeps everything (including react) in `devDependencies` on purpose; see the comment in `apps/desktop/electron.vite.config.ts`.
- `electron-vite@6.0.0-beta.1` is a prerelease. It is the only release compatible with Vite 8. Renovate will propose the stable 6.0.0 when it ships.

## Pull requests

Keep PRs focused on one change. Fill in the PR template, including how you tested. CI must be green before review.
