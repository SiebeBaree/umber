import type { LocalApiRequest, LocalApiStatus } from '@umber/ui/local-api'
import type { UpdateStatus } from '@umber/ui/updates'
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

import {
    BRIDGE_KEY,
    NET_CHANNEL,
    readAppVersionArgument,
    toOperatingSystem,
    UPDATE_CHANNELS,
    VAULT_CHANNELS,
    type NetRequestDto,
    type UmberBridge,
    type VaultSaveDto,
} from '../shared/bridge'
import { LOCAL_API_CHANNELS } from '../shared/local-api'

/**
 * The renderer is sandboxed and context-isolated, so this is the only channel
 * through which it learns anything about the machine it is running on — and
 * the only road credentials travel between the UI and the main process.
 */
const bridge: UmberBridge = {
    localApi: {
        status: () => ipcRenderer.invoke(LOCAL_API_CHANNELS.status),
        setEnabled: (enabled) => ipcRenderer.invoke(LOCAL_API_CHANNELS.enable, enabled),
        reset: () => ipcRenderer.invoke(LOCAL_API_CHANNELS.reset),
        onStatus: (listener) => {
            const receive = (_event: IpcRendererEvent, status: LocalApiStatus) => listener(status)
            ipcRenderer.on(LOCAL_API_CHANNELS.changed, receive)
            return () => {
                ipcRenderer.removeListener(LOCAL_API_CHANNELS.changed, receive)
            }
        },
        handle: (handler) => {
            const receive = (_event: IpcRendererEvent, request: LocalApiRequest) => {
                void handler(request)
                    .then(
                        (response) =>
                            ipcRenderer.invoke(LOCAL_API_CHANNELS.response, request.id, response),
                        () =>
                            ipcRenderer.invoke(LOCAL_API_CHANNELS.response, request.id, {
                                status: 500,
                                body: {
                                    error: {
                                        code: 'internal_error',
                                        message: 'Umber could not complete this request.',
                                    },
                                },
                            }),
                    )
                    .catch(() => {
                        /* The renderer or main process is shutting down. */
                    })
            }
            ipcRenderer.on(LOCAL_API_CHANNELS.request, receive)
            void ipcRenderer.invoke(LOCAL_API_CHANNELS.ready, true).catch(() => {})
            return () => {
                ipcRenderer.removeListener(LOCAL_API_CHANNELS.request, receive)
                void ipcRenderer.invoke(LOCAL_API_CHANNELS.ready, false).catch(() => {})
            }
        },
    },
    os: toOperatingSystem(process.platform),
    versions: {
        // Absent only if the window was created without the switch, which no
        // code path does; the fallback keeps the footer from reading "undefined".
        app: readAppVersionArgument(process.argv) ?? 'unknown',
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
    updates: {
        status: () => ipcRenderer.invoke(UPDATE_CHANNELS.status),
        check: () => ipcRenderer.invoke(UPDATE_CHANNELS.check),
        install: () => ipcRenderer.invoke(UPDATE_CHANNELS.install),
        onStatus: (listener) => {
            const receive = (_event: IpcRendererEvent, status: UpdateStatus) => listener(status)
            ipcRenderer.on(UPDATE_CHANNELS.changed, receive)
            return () => {
                ipcRenderer.removeListener(UPDATE_CHANNELS.changed, receive)
            }
        },
    },
}

contextBridge.exposeInMainWorld(BRIDGE_KEY, bridge)
