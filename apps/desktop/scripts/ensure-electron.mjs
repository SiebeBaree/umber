/**
 * Makes sure the Electron binary is on disk before anything tries to launch it.
 *
 * Electron 43 dropped the postinstall step that used to download it: the
 * package now fetches the binary the first time `require('electron')` resolves
 * it, and writes the `path.txt` beside itself that everyone else reads.
 * electron-vite reads that file directly, so on a `node_modules` tree where the
 * app has never been launched it finds nothing and dies with `Electron
 * uninstall` before the download can ever be triggered. That is every fresh
 * install, and every new git worktree, which each get a tree of their own.
 *
 * Requiring the module is the download. It is also the no-op once the binary is
 * there — a few milliseconds and an existence check — so the dev and preview
 * scripts can pay it every time they start.
 *
 * Deliberately not a `postinstall`: CI installs to lint, typecheck and build,
 * none of which launch Electron, and would be made to fetch ~100 MB for it.
 */

import { createRequire } from 'node:module'

createRequire(import.meta.url)('electron')
