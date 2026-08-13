import { useCallback, useState } from 'react'

import type { KeyProvider, NewConnection } from './key-providers'
import { verifyConnection } from './verify-connection'

/**
 * The connect button's state machine. A failure blocks the connect; a warning
 * explains what will not work yet and lets a second press through.
 */
export type CheckState =
    | { readonly phase: 'idle' }
    | { readonly phase: 'checking' }
    | { readonly phase: 'failed'; readonly message: string }
    | { readonly phase: 'unverified'; readonly message: string }

export interface ConnectCheck {
    readonly check: CheckState
    /** Clears the verdict; call when an edited field invalidates it. */
    readonly invalidate: () => void
    /** Runs the check and, when it passes, hands the credentials over. */
    readonly connect: (credentials: Readonly<Record<string, string>>) => Promise<void>
}

/** Hands the credentials over, translating a storage failure into a verdict. */
async function save(
    onConnect: (connection: NewConnection) => Promise<void>,
    connection: NewConnection,
    setCheck: (state: CheckState) => void,
): Promise<void> {
    try {
        await onConnect(connection)
    } catch {
        setCheck({
            phase: 'failed',
            message: 'The key could not be saved on this device. Try again.',
        })
    }
}

export function useConnectCheck(
    provider: KeyProvider,
    onConnect: (connection: NewConnection) => Promise<void>,
): ConnectCheck {
    const [check, setCheck] = useState<CheckState>({ phase: 'idle' })

    const invalidate = useCallback(() => {
        setCheck({ phase: 'idle' })
    }, [])

    const connect = useCallback(
        async (credentials: Readonly<Record<string, string>>) => {
            if (check.phase === 'checking') {
                return
            }

            const connection: NewConnection = { providerId: provider.id, credentials }

            // A warning has been read once; the second press means go.
            if (check.phase === 'unverified') {
                await save(onConnect, connection, setCheck)
                return
            }

            setCheck({ phase: 'checking' })
            const verdict = await verifyConnection(provider, credentials)

            if (!verdict.ok) {
                setCheck({ phase: 'failed', message: verdict.message })
                return
            }

            if (verdict.warning !== undefined) {
                setCheck({ phase: 'unverified', message: verdict.warning })
                return
            }

            await save(onConnect, connection, setCheck)
        },
        [check.phase, onConnect, provider],
    )

    return { check, invalidate, connect }
}
