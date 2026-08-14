# Umber

> **TODO:** one-paragraph description of what Umber is. Everything below documents the repository setup, which is independent of what the product becomes.

A local-first AI image and video studio you point at your own API keys.

## What's in the box

```
apps/
  desktop/      Electron shell — electron-vite + electron-builder. Mounts @umber/ui and nothing else.
packages/
  ui/           The actual application UI: every screen, plus the Tailwind theme.
  brand/        Umber's logo assets, and the only place to get them from.
  tsconfig/     Shared TypeScript configs (strict; see base.json).
tests/          All tests live here (Vitest + jsdom), run from the repo root.
```

The shell and the UI are **deliberately separate**: `apps/desktop` owns windows, processes and the preload bridge, and `packages/ui` owns everything a user sees. Nothing in `packages/ui` may import from `apps/` — that boundary is what keeps the UI portable to another shell later.

`packages/brand` holds the marks once, for everything that needs them — the header lockup, the installed app's icon, and whatever comes next. The SVGs in `brand/assets` are the source of truth: `src/index.ts` only points at them, so nothing ever re-draws a logo and no copy can drift. Add a mark by dropping the file in and exporting it there.

## Requirements

- **Node 24** (pinned in `.nvmrc`; installs fail on older versions because `engine-strict` is on)
- **pnpm 11** (pinned in `packageManager`; run `corepack enable` once)

## Getting started

```bash
pnpm install
pnpm dev        # launches Electron; the renderer dev server prefers :5174 (next free port if busy — see the startup log)
```

## Commands

| Command                                | What it does                                      |
| -------------------------------------- | ------------------------------------------------- |
| `pnpm dev`                             | Start the app in watch mode                       |
| `pnpm build`                           | Build all packages (Turborepo, cached)            |
| `pnpm test` / `pnpm test:watch`        | Run the test suite in `tests/`                    |
| `pnpm typecheck`                       | Root `tsc` + per-package typecheck                |
| `pnpm lint` / `pnpm lint:fix`          | oxlint (warnings are errors)                      |
| `pnpm format` / `pnpm format:check`    | oxfmt                                             |
| `pnpm check`                           | Everything CI runs, in order — run before pushing |
| `pnpm clean`                           | Delete build output and caches                    |
| `pnpm --filter @umber/desktop package` | Unpacked desktop build (no installer)             |
| `pnpm --filter @umber/desktop release` | Full desktop installers via electron-builder      |
| `pnpm --filter @umber/desktop start`   | Preview the built desktop app                     |

## Tooling decisions

- **pnpm catalogs** — versions shared by multiple packages live once in the `catalog:` section of `pnpm-workspace.yaml`. Bump there, not in individual manifests.
- **Turborepo** — caches `build` and `typecheck` per package. `test`, `lint`, and `format` are deliberately root-only scripts (one Vitest run, one oxlint run over the whole repo) and are not turbo tasks.
- **oxlint + oxfmt** — no ESLint/Prettier. VS Code is pre-configured to use the oxc extension (`.vscode/`); other editors get `.editorconfig`. Pre-commit hooks (lefthook) run both on staged files.
- **Tailwind CSS 4, CSS-first** — no `tailwind.config.*`. The theme, the `glass` utilities and the canvas live in `packages/ui/src/styles.css`; the app's entry CSS declares its own `@source` so the UI package never references app paths.
- **TanStack Router** — routes are defined in code (`packages/ui/src/router.tsx`), not by file convention, because the UI package is a library rather than a route directory. History is hash-based so routing survives the packaged `file://` renderer.
- **Strict TypeScript** — all packages extend `packages/tsconfig/base.json` (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, …).
- **Desktop dependency layout** — `apps/desktop` keeps everything (including react) in `devDependencies` on purpose; see the comment in `apps/desktop/electron.vite.config.ts`.

## Testing

Tests live in the root `tests/` directory and run with `pnpm test` (Vitest, jsdom). The shell keeps its wiring in `mount.tsx` / `runtime.ts` precisely so it can be tested without a real Electron window.

## Releasing the desktop app

Umber is distributed as GitHub releases. `apps/desktop/package.json`'s `version` is the single source of truth: electron-builder stamps it into the build, and `app.getVersion()` reports it back to the settings page.

To cut a release: bump that version, commit it, then push a matching tag.

```sh
git tag v0.2.0 && git push origin v0.2.0
```

`.github/workflows/release.yml` builds macOS (x64 and arm64), Windows and Linux on their own runners and uploads every installer into one **draft** release. Check the assets, then publish the release by hand — the running app only ever sees published, non-prerelease tags.

Each copy of the app polls `/releases/latest` on launch and every six hours (`apps/desktop/src/main/updates.ts`). When it finds a newer tag the settings button grows a dot and the settings page leads with the notice, whose button opens the installer for that machine in the browser.

- The app icon lives at `apps/desktop/build/icon.png` and is committed. It is generated from `packages/brand/assets/icon.svg` with `pnpm --filter @umber/brand icons` (macOS only — it uses `sips`), and electron-builder derives the macOS `.icns` and Windows `.ico` from it. Re-run it only when the mark changes.
- **TODO:** configure macOS code signing + notarization (hardened runtime, entitlements). Nothing is signed today, so macOS shows the unidentified-developer warning and Windows shows a SmartScreen prompt on first run.
- **TODO:** once signing is in place, swap the check-and-notify updater for `electron-updater`. That means adding a `zip` target to the `mac` block and rewriting `download()` in `apps/desktop/src/main/updates.ts` — the renderer only learns _whether_ there is an update, so no UI changes with it.

## Known trade-offs

- `electron-vite@6.0.0-beta.1` is a prerelease — it is the only release compatible with Vite 8. Renovate will propose the stable 6.0.0 when it ships.

## Contributing & security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
