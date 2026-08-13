import { App, type KeyVault } from '@umber/ui'
import { StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import type { UmberBridge } from '../../shared/bridge'
import { describeRuntime } from './runtime'

import './styles.css'

/**
 * The preload bridge's vault, spoken in the UI package's terms. The two
 * interfaces match by construction; the adapter exists so `@umber/ui` never
 * has to know Electron IPC is behind it.
 */
function toKeyVault(bridge: UmberBridge): KeyVault {
    return {
        list: () => bridge.vault.list(),
        save: (entry) => bridge.vault.save(entry),
        remove: (providerId) => bridge.vault.remove(providerId),
        credentials: (providerId) => bridge.vault.credentials(providerId),
    }
}

/**
 * Mounts the shared UI into `container`. Kept separate from `main.tsx` so the
 * wiring can be exercised in tests without an Electron window.
 */
export function mount(container: HTMLElement): Root {
    const root = createRoot(container)

    root.render(
        <StrictMode>
            <App
                overlaidWindowControls={window.umber?.os === 'macos'}
                runtime={describeRuntime(window.umber)}
                vault={window.umber === undefined ? undefined : toKeyVault(window.umber)}
            />
        </StrictMode>,
    )

    return root
}
