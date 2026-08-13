import { contextBridge, ipcRenderer } from 'electron'

import {
    BRIDGE_KEY,
    NET_CHANNEL,
    toOperatingSystem,
    VAULT_CHANNELS,
    type NetRequestDto,
    type UmberBridge,
    type VaultSaveDto,
} from '../shared/bridge'

/**
 * The renderer is sandboxed and context-isolated, so this is the only channel
 * through which it learns anything about the machine it is running on — and
 * the only road credentials travel between the UI and the main process.
 */
const bridge: UmberBridge = {
    os: toOperatingSystem(process.platform),
    versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
    },
    vault: {
        list: () => ipcRenderer.invoke(VAULT_CHANNELS.list),
        save: (entry: VaultSaveDto) => ipcRenderer.invoke(VAULT_CHANNELS.save, entry),
        remove: (providerId: string) => ipcRenderer.invoke(VAULT_CHANNELS.remove, providerId),
        credentials: (providerId: string) =>
            ipcRenderer.invoke(VAULT_CHANNELS.credentials, providerId),
    },
    net: {
        fetch: (request: NetRequestDto) => ipcRenderer.invoke(NET_CHANNEL, request),
    },
}

contextBridge.exposeInMainWorld(BRIDGE_KEY, bridge)
