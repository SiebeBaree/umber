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

/**
 * One provider HTTP request, decomposed so it can cross IPC. Mirrors
 * `@umber/ui`'s transport shapes — the renderer builds these, the main process
 * performs them with its own network stack, which is not subject to CORS.
 */
export type NetFormPartDto =
    | { readonly kind: 'field'; readonly name: string; readonly value: string }
    | {
          readonly kind: 'file'
          readonly name: string
          readonly filename: string
          readonly contentType: string
          readonly bytes: Uint8Array
      }

export type NetBodyDto =
    | { readonly kind: 'text'; readonly text: string; readonly contentType: string }
    | { readonly kind: 'form'; readonly parts: readonly NetFormPartDto[] }

export interface NetRequestDto {
    readonly url: string
    readonly method: string
    readonly headers: Readonly<Record<string, string>>
    readonly body?: NetBodyDto
}

export interface NetResponseDto {
    readonly status: number
    readonly headers: Readonly<Record<string, string>>
    readonly body: Uint8Array
}

export const NET_CHANNEL = 'umber:net:fetch'

export interface UmberNetBridge {
    fetch(request: NetRequestDto): Promise<NetResponseDto>
}

export interface UmberBridge {
    readonly os: UmberOperatingSystem
    readonly versions: UmberVersions
    readonly vault: UmberVaultBridge
    readonly net: UmberNetBridge
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
