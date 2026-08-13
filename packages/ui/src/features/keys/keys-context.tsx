import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'

import { localVault, type KeyVault, type VaultConnection } from './vault'

/**
 * The single source of truth for which providers are connected. Loaded from
 * the vault once at startup, then kept in sync as keys are added and removed —
 * so the settings page, the model picker and the generate button all agree.
 */
export interface KeysApi {
    /** False until the vault has answered; gates "no keys yet" empty states. */
    readonly ready: boolean
    readonly connections: readonly VaultConnection[]
    readonly connectedProviders: ReadonlySet<string>
    readonly connect: (
        providerId: string,
        credentials: Readonly<Record<string, string>>,
    ) => Promise<void>
    readonly remove: (providerId: string) => Promise<void>
    readonly credentials: (providerId: string) => Promise<Readonly<Record<string, string>> | null>
}

const KeysContext = createContext<KeysApi | null>(null)

export interface KeysProviderProps {
    readonly vault?: KeyVault | undefined
    readonly children: ReactNode
}

/** The visible tail of a credential, enough to tell keys apart later. */
function keyTailOf(credentials: Readonly<Record<string, string>>): string {
    const primary = Object.values(credentials)[0]?.trim() ?? ''

    return primary.slice(-4)
}

/** The vault's list, loaded once per vault, plus the setter mutations use. */
function useVaultList(vault: KeyVault) {
    const [connections, setConnections] = useState<readonly VaultConnection[]>([])
    const [ready, setReady] = useState(false)

    useEffect(() => {
        let cancelled = false

        const load = async () => {
            try {
                const listed = await vault.list()

                if (!cancelled) {
                    setConnections(listed)
                }
            } catch {
                // An unreadable vault behaves as an empty one; connecting a key
                // again will surface the underlying problem if it persists.
            } finally {
                if (!cancelled) {
                    setReady(true)
                }
            }
        }

        void load()

        return () => {
            cancelled = true
        }
    }, [vault])

    return { connections, setConnections, ready }
}

export function KeysProvider({ children, vault = localVault }: KeysProviderProps) {
    const { connections, ready, setConnections } = useVaultList(vault)

    const connect = useCallback(
        async (providerId: string, credentials: Readonly<Record<string, string>>) => {
            const saved = await vault.save({
                providerId,
                credentials,
                keyTail: keyTailOf(credentials),
            })

            setConnections((current) => [
                ...current.filter((connection) => connection.providerId !== providerId),
                saved,
            ])
        },
        [vault, setConnections],
    )

    const remove = useCallback(
        async (providerId: string) => {
            await vault.remove(providerId)

            setConnections((current) =>
                current.filter((connection) => connection.providerId !== providerId),
            )
        },
        [vault, setConnections],
    )

    const credentials = useCallback((providerId: string) => vault.credentials(providerId), [vault])

    const value = useMemo<KeysApi>(
        () => ({
            ready,
            connections,
            connectedProviders: new Set(connections.map((connection) => connection.providerId)),
            connect,
            remove,
            credentials,
        }),
        [ready, connections, connect, remove, credentials],
    )

    return <KeysContext.Provider value={value}>{children}</KeysContext.Provider>
}

export function useKeys(): KeysApi {
    const api = useContext(KeysContext)

    if (api === null) {
        throw new Error('useKeys must be used inside a KeysProvider')
    }

    return api
}
