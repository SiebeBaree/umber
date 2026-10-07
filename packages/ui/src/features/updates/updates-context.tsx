import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'

import { useNotifications } from '../notifications/notifications-context'
import { NO_UPDATES, type UpdateChecker, type UpdateStatus } from './checker'

export type { UpdateChecker, UpdateStatus }

export interface UpdatesApi {
    readonly status: UpdateStatus
    readonly retry: () => void
    readonly restart: () => void
}

const NO_NEWS: UpdateStatus = { state: 'idle', latestVersion: null }
const UpdatesContext = createContext<UpdatesApi | null>(null)

export interface UpdatesProviderProps {
    readonly children: ReactNode
    readonly checker?: UpdateChecker | undefined
}

/** Subscribe before reading so a download finishing during mount cannot be missed. */
function useUpdateStatus(checker: UpdateChecker): UpdateStatus {
    const [status, setStatus] = useState<UpdateStatus>(NO_NEWS)

    useEffect(() => {
        let live = true
        let received = false
        setStatus(NO_NEWS)
        const unsubscribe = checker.onStatus((next) => {
            received = true
            if (live) setStatus(next)
        })
        const read = async () => {
            try {
                const next = await checker.status()
                if (live && !received) setStatus(next)
            } catch {
                // A later status event can still recover a failed initial read.
            }
        }
        void read()
        return () => {
            live = false
            unsubscribe()
        }
    }, [checker])

    return status
}

export function UpdatesProvider({ checker = NO_UPDATES, children }: UpdatesProviderProps) {
    const status = useUpdateStatus(checker)
    const { notify } = useNotifications()
    const retry = useCallback(() => {
        void checker.check().catch(() => {
            notify('Could not check for updates', 'Try again in Settings.')
        })
    }, [checker, notify])
    const restart = useCallback(() => {
        void checker.install().catch(() => {
            notify('Could not restart Umber', 'Try again in Settings.')
        })
    }, [checker, notify])
    const value = useMemo<UpdatesApi>(() => ({ status, retry, restart }), [status, retry, restart])

    return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>
}

export function useUpdates(): UpdatesApi {
    const api = useContext(UpdatesContext)
    if (api === null) throw new Error('useUpdates must be used inside an UpdatesProvider')
    return api
}
