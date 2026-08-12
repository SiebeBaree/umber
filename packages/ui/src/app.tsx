import { RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

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
}

/**
 * The entire Umber application. `@umber/desktop` mounts this component and
 * nothing else, which keeps every product decision inside this package.
 *
 * Both props are read once, when the component first mounts: they describe the
 * host shell, which cannot change while the app is running.
 */
export function App({ overlaidWindowControls = false, runtime }: AppProps) {
    const [router] = useState(() => createUmberRouter({ overlaidWindowControls, runtime }))

    return <RouterProvider router={router} />
}
