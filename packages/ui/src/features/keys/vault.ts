/**
 * Where provider credentials live.
 *
 * The UI never touches storage directly: it talks to a `KeyVault`, and the
 * shell decides what that is. The desktop app passes one backed by Electron's
 * `safeStorage` in the main process; anything without a bridge (the browser
 * preview, tests) falls back to `localVault` below, which trades encryption
 * for working everywhere `localStorage` does.
 */

export interface VaultConnection {
    readonly providerId: string
    /** The last few characters of the key, for display as `···· 4f2a`. */
    readonly keyTail: string
    /** ISO timestamp of when the key was saved. */
    readonly addedAt: string
}

export interface VaultEntry {
    readonly providerId: string
    readonly keyTail: string
    /** Field id → value, exactly as the provider's credential form declares. */
    readonly credentials: Readonly<Record<string, string>>
}

export interface KeyVault {
    list(): Promise<readonly VaultConnection[]>
    save(entry: VaultEntry): Promise<VaultConnection>
    remove(providerId: string): Promise<void>
    credentials(providerId: string): Promise<Readonly<Record<string, string>> | null>
}

const LOCAL_KEY = 'umber.vault.v1'

interface LocalRecord {
    readonly keyTail: string
    readonly addedAt: string
    readonly credentials: Readonly<Record<string, string>>
}

function readLocal(): Record<string, LocalRecord> {
    try {
        const raw = globalThis.localStorage?.getItem(LOCAL_KEY)
        const parsed: unknown = raw == null ? null : JSON.parse(raw)

        return typeof parsed === 'object' && parsed !== null
            ? (parsed as Record<string, LocalRecord>)
            : {}
    } catch {
        return {}
    }
}

function writeLocal(records: Record<string, LocalRecord>): void {
    try {
        globalThis.localStorage?.setItem(LOCAL_KEY, JSON.stringify(records))
    } catch {
        // Nowhere to persist; the session still works from memory via context.
    }
}

/** The no-bridge fallback. Plaintext in `localStorage`, so dev-grade only. */
export const localVault: KeyVault = {
    list() {
        const records = readLocal()

        return Promise.resolve(
            Object.entries(records)
                .map(([providerId, record]) => ({
                    providerId,
                    keyTail: record.keyTail,
                    addedAt: record.addedAt,
                }))
                .toSorted((a, b) => a.addedAt.localeCompare(b.addedAt)),
        )
    },

    save(entry) {
        const records = readLocal()
        const connection: VaultConnection = {
            providerId: entry.providerId,
            keyTail: entry.keyTail,
            addedAt: new Date().toISOString(),
        }

        records[entry.providerId] = {
            keyTail: entry.keyTail,
            addedAt: connection.addedAt,
            credentials: entry.credentials,
        }
        writeLocal(records)

        return Promise.resolve(connection)
    },

    remove(providerId) {
        const records = readLocal()
        delete records[providerId]
        writeLocal(records)

        return Promise.resolve()
    },

    credentials(providerId) {
        return Promise.resolve(readLocal()[providerId]?.credentials ?? null)
    },
}
