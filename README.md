# Umber

> **TODO:** one-paragraph description of what Umber is. Everything below documents the repository setup, which is independent of what the product becomes.

One shared React UI, shipped twice: as a web app and as an Electron desktop app.

## What's in the box

```
apps/
  web/          Browser shell — Vite + React. Mounts @umber/ui and nothing else.
  desktop/      Electron shell — electron-vite + electron-builder. Also only mounts @umber/ui.
packages/
  ui/           The actual application UI, shared verbatim by both shells. Tailwind theme lives here.
  tsconfig/     Shared TypeScript configs (strict; see base.json).
tests/          All tests live here (Vitest + jsdom), run from the repo root.
```

The two shells are **intentionally parallel, not shared**: `apps/web/src` and `apps/desktop/src/renderer/src` have the same file layout and near-identical code, so each can be read top-to-bottom in isolation. Resist the urge to extract a shared `mount` helper — the duplication is small and buys readability.

## Requirements

- **Node 24** (pinned in `.nvmrc`; installs fail on older versions because `engine-strict` is on)
- **pnpm 11** (pinned in `packageManager`; run `corepack enable` once)

## Getting started

```bash
pnpm install
pnpm dev        # web on http://localhost:5173, desktop renderer on :5174
```

## Commands

| Command                                | What it does                                      |
| -------------------------------------- | ------------------------------------------------- |
| `pnpm dev`                             | Start both apps in watch mode                     |
| `pnpm dev:web` / `pnpm dev:desktop`    | Start one app                                     |
| `pnpm build`                           | Build all packages (Turborepo, cached)            |
| `pnpm test` / `pnpm test:watch`        | Run the test suite in `tests/`                    |
| `pnpm typecheck`                       | Root `tsc` + per-package typecheck                |
| `pnpm lint` / `pnpm lint:fix`          | oxlint (warnings are errors)                      |
| `pnpm format` / `pnpm format:check`    | oxfmt                                             |
| `pnpm check`                           | Everything CI runs, in order — run before pushing |
| `pnpm clean`                           | Delete build output and caches                    |
| `pnpm --filter @umber/web preview`     | Serve the production web build                    |
| `pnpm --filter @umber/desktop package` | Unpacked desktop build (no installer)             |
| `pnpm --filter @umber/desktop release` | Full desktop installers via electron-builder      |
| `pnpm --filter @umber/desktop start`   | Preview the built desktop app                     |

## Tooling decisions

- **pnpm catalogs** — versions shared by multiple packages live once in the `catalog:` section of `pnpm-workspace.yaml`. Bump there, not in individual manifests.
- **Turborepo** — caches `build` and `typecheck` per package. `test`, `lint`, and `format` are deliberately root-only scripts (one Vitest run, one oxlint run over the whole repo) and are not turbo tasks.
- **oxlint + oxfmt** — no ESLint/Prettier. VS Code is pre-configured to use the oxc extension (`.vscode/`); other editors get `.editorconfig`. Pre-commit hooks (lefthook) run both on staged files.
- **Tailwind CSS 4, CSS-first** — no `tailwind.config.*`. The theme is defined in `packages/ui/src/styles.css`; each app's entry CSS declares its own `@source` so the shared package never references app paths.
- **Strict TypeScript** — all packages extend `packages/tsconfig/base.json` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, …).
- **Desktop dependency layout** — `apps/desktop` keeps everything (including react) in `devDependencies` on purpose; see the comment in `apps/desktop/electron.vite.config.ts`.

## Testing

Tests live in the root `tests/` directory and run with `pnpm test` (Vitest, jsdom). The shells keep their wiring in `mount.tsx` / `runtime.ts` precisely so it can be tested without a real browser page or Electron window.

## Releasing the desktop app

`pnpm --filter @umber/desktop release` builds installers with electron-builder (`electron-builder.yml`). Before shipping a real release you still need to:

- **TODO:** add icons and build resources under `apps/desktop/build/` (`icon.icns`, `icon.ico`, `icon.png`)
- **TODO:** configure macOS code signing + notarization (hardened runtime, entitlements)
- **TODO:** add a `publish` config if you want auto-updates

## Known trade-offs

- `electron-vite@6.0.0-beta.1` is a prerelease — it is the only release compatible with Vite 8. Renovate will propose the stable 6.0.0 when it ships.

## Contributing & security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
