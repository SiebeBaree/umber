/**
 * The contract between the preload script and the renderer.
 *
 * This is the only thing the desktop shell adds on top of `@umber/ui`. Keeping it
 * in one file means the preload script and the renderer can never disagree about
 * the shape of `window.umber`.
 */

/** The global the preload script exposes the bridge under. */
export const BRIDGE_KEY = 'umber'

export interface UmberVersions {
    readonly electron: string
    readonly chrome: string
    readonly node: string
}

/**
 * The host operating system, reduced to what the UI actually reacts to. macOS is
 * the only one that paints its window controls *over* the app's own chrome.
 */
export type UmberOperatingSystem = 'macos' | 'windows' | 'linux'

/** A connected provider, as the vault reports it. Mirrors `@umber/ui`'s shape. */
export interface VaultConnectionDto {
    readonly providerId: string
    readonly keyTail: string
    /** ISO timestamp of when the key was saved. */
    readonly addedAt: string
}

export interface VaultSaveDto {
    readonly providerId: string
    readonly keyTail: string
    /** Field id → value, exactly as the provider's credential form declares. */
    readonly credentials: Readonly<Record<string, string>>
}

/**
 * Credential storage, backed by `safeStorage` in the main process. The
 * renderer only ever sees credentials it explicitly asks for, right before a
 * generation call needs them.
 */
export interface UmberVaultBridge {
    list(): Promise<readonly VaultConnectionDto[]>
    save(entry: VaultSaveDto): Promise<VaultConnectionDto>
    remove(providerId: string): Promise<void>
    credentials(providerId: string): Promise<Readonly<Record<string, string>> | null>
}

/** The IPC channel per vault method; shared so both sides stay in step. */
export const VAULT_CHANNELS = {
    list: 'umber:vault:list',
    save: 'umber:vault:save',
    remove: 'umber:vault:remove',
    credentials: 'umber:vault:credentials',
} as const

export interface UmberBridge {
    readonly os: UmberOperatingSystem
    readonly versions: UmberVersions
    readonly vault: UmberVaultBridge
}

/**
 * Maps Node's `process.platform` onto the three cases the UI distinguishes.
 * Takes a plain `string` because this file is also compiled for the sandboxed
 * renderer, where the `NodeJS` namespace does not exist.
 */
export function toOperatingSystem(platform: string): UmberOperatingSystem {
    if (platform === 'darwin') {
        return 'macos'
    }

    return platform === 'win32' ? 'windows' : 'linux'
}
