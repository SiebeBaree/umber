import { App } from '@umber/ui'
import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import './styles.css'

/** Describes the browser build to the shared footer. */
export function describeRuntime(mode: string): string {
    return `Web · ${mode} build`
}

/**
 * Mounts the shared UI into `container`. Kept separate from `main.tsx` so the
 * wiring can be exercised in tests without a real `index.html`.
 */
export function mount(container: HTMLElement): Root {
    const root = createRoot(container)

    root.render(
        <StrictMode>
            <App platform="web" runtime={describeRuntime(import.meta.env.MODE)} />
        </StrictMode>,
    )

    return root
}
