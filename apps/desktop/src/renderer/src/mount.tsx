import { App } from '@umber/ui'
import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { describeRuntime } from './runtime'

import './styles.css'

/**
 * Mounts the shared UI into `container`. Kept separate from `main.tsx` so the
 * wiring can be exercised in tests without an Electron window.
 */
export function mount(container: HTMLElement): Root {
    const root = createRoot(container)

    root.render(
        <StrictMode>
            <App platform="desktop" runtime={describeRuntime(window.umber)} />
        </StrictMode>,
    )

    return root
}
