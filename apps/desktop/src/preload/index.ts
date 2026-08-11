import { contextBridge } from 'electron'

import { BRIDGE_KEY, type UmberBridge } from '../shared/bridge'

/**
 * The renderer is sandboxed and context-isolated, so this is the only channel
 * through which it learns anything about the machine it is running on.
 */
const bridge: UmberBridge = {
    platform: 'desktop',
    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
    },
}

contextBridge.exposeInMainWorld(BRIDGE_KEY, bridge)
