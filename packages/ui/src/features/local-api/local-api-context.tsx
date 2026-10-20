import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'

import { useGeneration } from '../generate/generation-context'
import { useKeys } from '../keys/keys-context'
import type { LocalApiBridge, LocalApiSettings, LocalApiStatus } from './contract'
import { serveLocalApi } from './service'

interface LocalApiContextValue {
    readonly available: boolean
    readonly status: LocalApiStatus | null
    readonly busy: boolean
    readonly error: string | null
    readonly update: (patch: Partial<LocalApiSettings>) => void
    readonly reset: () => Promise<void>
}

const LocalApiContext = createContext<LocalApiContextValue | null>(null)

function useApiHandler(bridge: LocalApiBridge | undefined) {
    const keys = useKeys()
    const generation = useGeneration()
    const current = useRef({ keys, generation })
    useEffect(() => {
        current.current = { keys, generation }
    }, [keys, generation])
    useEffect(
        () =>
            bridge?.handle((request) =>
                serveLocalApi(request, current.current.keys, current.current.generation),
            ),
        [bridge],
    )
}

/** The shell's status, read once and then pushed on every change. */
function useBridgeStatus(bridge: LocalApiBridge | undefined) {
    const [status, setStatus] = useState<LocalApiStatus | null>(null)
    const [error, setError] = useState<string | null>(null)
    useEffect(() => {
        if (bridge === undefined) return
        let active = true
        const unsubscribe = bridge.onStatus(setStatus)
        const load = async () => {
            try {
                const next = await bridge.status()
                if (active) setStatus(next)
            } catch {
                if (active) setError('Could not read the local API settings.')
            }
        }
        void load()
        return () => {
            active = false
            unsubscribe()
        }
    }, [bridge])
    return { status, setStatus, error, setError }
}

export function LocalApiProvider({
    bridge,
    children,
}: {
    readonly bridge: LocalApiBridge | undefined
    readonly children: ReactNode
}) {
    const { error, setError, setStatus, status } = useBridgeStatus(bridge)
    const [busy, setBusy] = useState(false)
    useApiHandler(bridge)
    const update = useCallback(
        (patch: Partial<LocalApiSettings>) => {
            if (bridge === undefined || busy) return
            setBusy(true)
            setError(null)
            void bridge
                .update(patch)
                .then(setStatus)
                .catch(() => setError('Could not change the local API settings. Try again.'))
                .finally(() => setBusy(false))
        },
        [bridge, busy, setError, setStatus],
    )
    const reset = useCallback(async () => {
        if (bridge !== undefined) setStatus(await bridge.reset())
    }, [bridge, setStatus])
    const value = useMemo(
        () => ({ available: bridge !== undefined, status, busy, error, update, reset }),
        [bridge, status, busy, error, update, reset],
    )
    return <LocalApiContext.Provider value={value}>{children}</LocalApiContext.Provider>
}

export function useLocalApi() {
    const value = useContext(LocalApiContext)
    if (value === null) throw new Error('useLocalApi requires LocalApiProvider')
    return value
}
