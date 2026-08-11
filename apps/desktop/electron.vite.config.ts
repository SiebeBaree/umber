import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

/**
 * electron-vite's defaults already point at `src/main/index.ts`,
 * `src/preload/index.ts` and `src/renderer/index.html`, and emit to `out/`.
 *
 * `externalizeDepsPlugin` keeps anything listed under `dependencies` out of the
 * main and preload bundles. This package deliberately has none: everything the
 * app needs is bundled, so electron-builder ships `out/` and no `node_modules`.
 */
export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: { sourcemap: true },
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: { sourcemap: true },
    },
    renderer: {
        plugins: [react(), tailwindcss()],
        // Pinned so `pnpm dev` (which starts both apps) never has the two renderers
        // race for a port. @umber/web owns 5173.
        server: { port: 5174, strictPort: true },
        build: {
            sourcemap: true,
            // electron-vite ships with minification off. The main and preload bundles
            // are a few kB and are worth keeping readable in a crash report, but the
            // renderer carries React, so it gets minified like the web build does.
            minify: 'esbuild',
        },
    },
})
