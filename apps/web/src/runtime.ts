/**
 * Turns the Vite build mode into the one-line runtime summary the shared
 * footer renders. Pure, so it is easy to test. Mirrors the desktop shell's
 * `runtime.ts` so both shells have the same file layout.
 */
export function describeRuntime(mode: string): string {
    return `Web · ${mode} build`
}
