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
import type { LocalApiBridge, LocalApiStatus } from './contract'
import { serveLocalApi } from './service'

interface LocalApiContextValue {
    readonly available: boolean
    readonly status: LocalApiStatus | null
    readonly busy: boolean
    readonly error: string | null
    readonly toggle: () => void
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

export function LocalApiProvider({
    bridge,
    children,
}: {
    readonly bridge: LocalApiBridge | undefined
    readonly children: ReactNode
}) {
    const [status, setStatus] = useState<LocalApiStatus | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    useApiHandler(bridge)
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
    const toggle = useCallback(() => {
        if (bridge === undefined || status === null || busy) return
        setBusy(true)
        setError(null)
        void bridge
            .setEnabled(!status.enabled)
            .then(setStatus)
            .catch(() => setError('Could not change the local API settings. Try again.'))
            .finally(() => setBusy(false))
    }, [bridge, status, busy])
    const reset = useCallback(async () => {
        if (bridge !== undefined) setStatus(await bridge.reset())
    }, [bridge])
    const value = useMemo(
        () => ({ available: bridge !== undefined, status, busy, error, toggle, reset }),
        [bridge, status, busy, error, toggle, reset],
    )
    return <LocalApiContext.Provider value={value}>{children}</LocalApiContext.Provider>
}

export function useLocalApi() {
    const value = useContext(LocalApiContext)
    if (value === null) throw new Error('useLocalApi requires LocalApiProvider')
    return value
}
