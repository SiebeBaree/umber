import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import type { UserConfig } from 'vite'

/**
 * electron-vite's defaults already point at `src/main/index.ts`,
 * `src/preload/index.ts` and `src/renderer/index.html`, and emit to `out/`.
 *
 * `externalizeDepsPlugin` keeps anything listed under `dependencies` out of the
 * main and preload bundles. This package deliberately has none: everything the
 * app needs is bundled, so electron-builder ships `out/` and no `node_modules`.
 */

/**
 * The renderer's build recipe, exported so `vite.preview.config.ts` can serve
 * the identical renderer in a plain browser — one definition, so the preview
 * cannot drift from what Electron ships.
 */
export const rendererConfig: UserConfig = {
    plugins: [react(), tailwindcss()],
    // 5174 whenever it's free, so a single `pnpm dev` stays predictable —
    // but not strict: parallel worktree sessions each run their own dev
    // server, so a busy port slides to the next open one and Electron
    // follows wherever it lands via `ELECTRON_RENDERER_URL`.
    server: { port: 5174 },
    build: {
        sourcemap: true,
        // electron-vite ships with minification off. The main and preload bundles
        // are a few kB and are worth keeping readable in a crash report, but the
        // renderer carries React, so it gets minified like the web build does.
        minify: 'esbuild',
    },
}

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: { sourcemap: true },
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: { sourcemap: true },
    },
    renderer: rendererConfig,
})
