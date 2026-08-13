import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

import { GenerationProvider } from './features/generate/generation-context'
import { KeysProvider } from './features/keys/keys-context'
import type { KeyVault } from './features/keys/vault'
import { setHttpTransport, type HttpTransport } from './lib/http'
import { createUmberRouter } from './router'

export interface AppProps {
    /**
     * A short line describing the host runtime, shown on the settings page. The
     * shell fills this in with whatever it knows about itself.
     */
    readonly runtime?: string | undefined
    /**
     * Whether the host paints its window controls on top of the app rather than
     * in a title bar of its own — true for macOS, where the header has to leave
     * the traffic lights room.
     */
    readonly overlaidWindowControls?: boolean | undefined
    /**
     * Where provider credentials are kept. The desktop shell passes one backed
     * by the OS keychain via `safeStorage`; without one, a `localStorage`
     * fallback keeps the browser preview and tests working.
     */
    readonly vault?: KeyVault | undefined
    /**
     * How provider requests reach the network. The desktop shell passes one
     * that crosses into the main process, where CORS does not apply; without
     * one, plain `fetch` keeps the browser preview and tests working.
     */
    readonly transport?: HttpTransport | undefined
}

/**
 * The entire Umber application. `@umber/desktop` mounts this component and
 * nothing else, which keeps every product decision inside this package.
 *
 * All props are read once, when the component first mounts: they describe the
 * host shell, which cannot change while the app is running.
 */
export function App({ overlaidWindowControls = false, runtime, transport, vault }: AppProps) {
    const [router] = useState(() => createUmberRouter({ overlaidWindowControls, runtime }))

    // Installed before anything renders, so the first generation already goes
    // through the shell's network path. A singleton rather than context: the
    // transport describes the host, which cannot change while the app runs.
    useState(() => {
        setHttpTransport(transport)

        return null
    })

    return (
        <KeysProvider vault={vault}>
            <GenerationProvider>
                <RouterProvider router={router} />
            </GenerationProvider>
        </KeysProvider>
    )
}
