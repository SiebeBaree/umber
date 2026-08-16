# Releasing the desktop app

Umber is distributed as GitHub releases. `apps/desktop/package.json`'s `version` is the single source of truth: electron-builder stamps it into the build and `app.getVersion()` reports it back to the settings page.

To cut a release, bump that version, commit it, then push a matching tag.

```bash
git tag v0.2.0 && git push origin v0.2.0
```

[`.github/workflows/release.yml`](../.github/workflows/release.yml) builds macOS (arm64), Windows and Linux on their own runners and uploads every installer into one **draft** release. Check the assets, then publish the release by hand. The running app only ever sees published, non-prerelease tags.

To rehearse the whole matrix without tagging anything, run the workflow manually from the Actions tab. electron-builder still targets a draft release named after the current version, so all three platforms get exercised and nothing becomes public. Delete the draft afterwards.

Each copy of the app polls `/releases/latest` on launch and every six hours ([`updates-context.tsx`](../packages/ui/src/features/updates/updates-context.tsx) drives the interval, [`updates.ts`](../apps/desktop/src/main/updates.ts) does the fetch). When it finds a newer tag the settings button grows a dot and the settings page leads with the notice, whose button opens the installer for that machine in the browser.

Two things the release job depends on and that are easy to break:

- **The build command must not pass `--` before its flags.** pnpm 11 forwards `--` to the script verbatim instead of stripping it, and electron-builder reads a bare `--` as the end of the options. Every flag after it is collected as a positional and ignored, which costs you the target, the architectures and the publish step, without failing the job.
- **`artifactName` puts the architecture in every filename.** `pickInstaller` in [`release-feed.ts`](../apps/desktop/src/shared/release-feed.ts) matches on it to send an arm64 Mac to the arm64 dmg. Change the naming and change that function with it.

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

Once macOS signing is in place, the check-and-notify updater can be swapped for `electron-updater`. That means adding a `zip` target to the `mac` block and rewriting `download()` in [`updates.ts`](../apps/desktop/src/main/updates.ts). The renderer only learns _whether_ there is an update, so no UI changes with it. Note that after that switch the signing identity can no longer change freely: macOS will not let an app replace itself with a differently signed bundle.
