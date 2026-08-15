# Umber

A local-first AI image and video studio you point at your own API keys.

Umber is a desktop app that puts twelve image and video providers behind one interface. You bring your own keys, calls go straight from your machine to the provider and everything you generate stays on disk. There is no Umber account, no server in the middle and no subscription. Keys are encrypted with the OS keychain via Electron's `safeStorage` and kept in a single file under `userData`.

Providers: Google, OpenAI, Black Forest Labs, ByteDance, Kling, Alibaba, Runway, Ideogram, Recraft, MiniMax, xAI and Reve.

## Install

Grab the installer for your machine from the [latest release](https://github.com/SiebeBaree/umber/releases/latest).

| Platform | Asset                                                                              |
| -------- | ---------------------------------------------------------------------------------- |
| macOS    | `Umber-<version>-arm64.dmg` for Apple Silicon, `Umber-<version>-x64.dmg` for Intel |
| Windows  | `Umber-<version>-x64.exe`                                                          |
| Linux    | `Umber-<version>-x86_64.AppImage`                                                  |

**macOS.** Signed and notarized. Drag Umber to Applications and open it.

**Windows.** Not signed, so SmartScreen shows "Windows protected your PC" on first run. Choose _More info_, then _Run anyway_. The UAC prompt names an unknown publisher for the same reason. See [Signing status](#signing-status).

**Linux.** Mark the AppImage executable and run it:

```bash
chmod +x Umber-*.AppImage && ./Umber-*.AppImage
```

## What's in the box

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

## Requirements

- **Node 24** (pinned in `.nvmrc`; installs fail on older versions because `engine-strict` is on)
- **pnpm 11** (pinned in `packageManager`; run `corepack enable` once)

## Getting started

```bash
pnpm install
pnpm dev        # launches Electron; the renderer dev server prefers :5174 (next free port if busy, see the startup log)
```

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

## Testing

Tests live in the root `tests/` directory and run with `pnpm test` (Vitest, jsdom). The shell keeps its wiring in `mount.tsx` / `runtime.ts` precisely so it can be tested without a real Electron window.

## Releasing the desktop app

Umber is distributed as GitHub releases. `apps/desktop/package.json`'s `version` is the single source of truth: electron-builder stamps it into the build and `app.getVersion()` reports it back to the settings page.

To cut a release, bump that version, commit it, then push a matching tag.

```bash
git tag v0.2.0 && git push origin v0.2.0
```

[`.github/workflows/release.yml`](.github/workflows/release.yml) builds macOS (x64 and arm64), Windows and Linux on their own runners and uploads every installer into one **draft** release. Check the assets, then publish the release by hand. The running app only ever sees published, non-prerelease tags.

To rehearse the whole matrix without tagging anything, run the workflow manually from the Actions tab. electron-builder still targets a draft release named after the current version, so all three platforms get exercised and nothing becomes public. Delete the draft afterwards.

Each copy of the app polls `/releases/latest` on launch and every six hours ([`updates-context.tsx`](packages/ui/src/features/updates/updates-context.tsx) drives the interval, [`updates.ts`](apps/desktop/src/main/updates.ts) does the fetch). When it finds a newer tag the settings button grows a dot and the settings page leads with the notice, whose button opens the installer for that machine in the browser.

Two things the release job depends on and that are easy to break:

- **The build command must not pass `--` before its flags.** pnpm 11 forwards `--` to the script verbatim instead of stripping it, and electron-builder reads a bare `--` as the end of the options. Every flag after it is collected as a positional and ignored, which costs you the target, the architectures and the publish step, without failing the job.
- **`artifactName` puts the architecture in every filename.** `pickInstaller` in [`release-feed.ts`](apps/desktop/src/shared/release-feed.ts) matches on it to send an arm64 Mac to the arm64 dmg. Change the naming and change that function with it.

The app icon lives at `apps/desktop/build/icon.png` and is committed. It is generated from `packages/brand/assets/icon.svg` with `pnpm --filter @umber/brand icons` (macOS only, it uses `sips`), and electron-builder derives the macOS `.icns` and Windows `.ico` from it. Re-run it only when the mark changes.

## Signing status

macOS is signed and notarized. Windows and Linux are not. The `sign` flag on the matrix entry in the release workflow is what marks the difference, and every signing step keys off it rather than off the runner, so the day Windows gains a certificate it is one flag.

**macOS.** Signed with a Developer ID Application certificate and notarized through an App Store Connect API key. Both are needed: a signed build that was never notarized is still stopped on first launch. Five repository secrets carry it, and none of the material is ever in the repo:

| Secret             | What it holds                                             |
| ------------------ | --------------------------------------------------------- |
| `CSC_LINK`         | The `.p12` (certificate plus private key), base64 encoded |
| `CSC_KEY_PASSWORD` | The password set when exporting that `.p12`               |
| `APPLE_API_KEY_P8` | The App Store Connect `.p8`, pasted verbatim              |
| `APPLE_API_KEY_ID` | That key's Key ID                                         |
| `APPLE_API_ISSUER` | The Issuer ID from the same page                          |

The `.p12` is the one that matters. It carries the private key that proves a build is ours, so it belongs in Actions secrets and in the login keychain, nowhere else. `.gitignore` blocks the extensions as a backstop. If it ever leaks, revoke the certificate in the developer portal and issue a new one.

Notarization adds a few minutes per architecture, so a macOS release job runs noticeably longer than the other two.

**Windows.** An OV code signing certificate runs a few hundred dollars a year and now requires a hardware token or a cloud HSM. Azure Artifact Signing is about $10/month, but individual developers are limited to the USA and Canada; organizations cover the EU. The free alternative is the Microsoft Store, which signs what it distributes and no longer charges a registration fee. That would mean an `appx` target and store review, and updates would flow through the Store rather than through the release feed this app checks.

**Linux.** Nothing to sign. AppImages can be GPG signed but effectively nothing verifies the signature.

Once macOS signing is in place, the check-and-notify updater can be swapped for `electron-updater`. That means adding a `zip` target to the `mac` block and rewriting `download()` in [`updates.ts`](apps/desktop/src/main/updates.ts). The renderer only learns _whether_ there is an update, so no UI changes with it. Note that after that switch the signing identity can no longer change freely: macOS will not let an app replace itself with a differently signed bundle.

## Known trade-offs

- `electron-vite@6.0.0-beta.1` is a prerelease. It is the only release compatible with Vite 8. Renovate will propose the stable 6.0.0 when it ships.

## Contributing & security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
