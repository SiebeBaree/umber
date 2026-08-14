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
    /** Umber's own version, as `apps/desktop/package.json` declares it. */
    readonly app: string
    readonly electron: string
    readonly chrome: string
    readonly node: string
}

/**
 * The switch the main process reads the app version off its own command line
 * with, so the sandboxed preload can report it without a round trip.
 */
export const APP_VERSION_ARGUMENT = '--umber-app-version='

/** Pulls the app version out of a preload `process.argv`; `null` if absent. */
export function readAppVersionArgument(argv: readonly string[]): string | null {
    const argument = argv.find((entry) => entry.startsWith(APP_VERSION_ARGUMENT))

    return argument === undefined ? null : argument.slice(APP_VERSION_ARGUMENT.length)
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

/**
 * What one look at the release feed found. `latestVersion` is `null` while
 * nothing has been published yet, which is also what a failed check reports:
 * the app has no news either way, and says nothing rather than crying wolf.
 */
export interface UpdateStatusDto {
    readonly latestVersion: string | null
    readonly available: boolean
}

export const UPDATE_CHANNELS = {
    check: 'umber:updates:check',
    download: 'umber:updates:download',
} as const

/**
 * The update check. Deliberately narrow: the shell decides *how* an update
 * arrives, and today that is the browser opening the release. Swapping in a
 * real in-app installer later changes `download` and nothing the UI can see.
 */
export interface UmberUpdatesBridge {
    check(): Promise<UpdateStatusDto>
    download(): Promise<void>
}

export interface UmberBridge {
    readonly os: UmberOperatingSystem
    readonly versions: UmberVersions
    readonly vault: UmberVaultBridge
    readonly net: UmberNetBridge
    readonly updates: UmberUpdatesBridge
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
