import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react'

import { NO_UPDATES, type UpdateChecker, type UpdateStatus } from './checker'

export type { UpdateChecker, UpdateStatus }

/**
 * Whether a newer Umber is waiting, kept in one place because two very
 * different parts of the app react to it: the settings button in the header
 * wears a dot, and the settings page leads with the notice.
 *
 * The check runs on launch and then on a slow timer. Umber is a desktop app
 * people leave open for days, so a launch-only check would never fire for the
 * ones most likely to fall behind.
 */

/** Long enough to be invisible, short enough that a week-old window notices. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

export interface UpdatesApi extends UpdateStatus {
    /** True from the moment the update is asked for until the handover lands. */
    readonly starting: boolean
    /** Hands the update over to the shell. */
    readonly start: () => void
}

const NO_NEWS: UpdateStatus = { latestVersion: null, available: false }

const UpdatesContext = createContext<UpdatesApi | null>(null)

export interface UpdatesProviderProps {
    readonly children: ReactNode
    /** Without one, the app simply never has an update to report. */
    readonly checker?: UpdateChecker | undefined
}

/** The latest status the checker has reported, refreshed on the slow timer. */
function useUpdateStatus(checker: UpdateChecker): UpdateStatus {
    const [status, setStatus] = useState<UpdateStatus>(NO_NEWS)

    useEffect(() => {
        let live = true

        const run = async (): Promise<void> => {
            let next: UpdateStatus

            try {
                next = await checker.check()
            } catch {
                // A shell that cannot answer is not news; leave the last status
                // standing rather than retracting an update already found.
                return
            }

            // The check outlives the component on an unmount mid-flight.
            if (live) {
                setStatus(next)
            }
        }

        void run()
        const timer = globalThis.setInterval(() => {
            void run()
        }, CHECK_INTERVAL_MS)

        return () => {
            live = false
            globalThis.clearInterval(timer)
        }
    }, [checker])

    return status
}

export function UpdatesProvider({ checker = NO_UPDATES, children }: UpdatesProviderProps) {
    const status = useUpdateStatus(checker)
    const [starting, setStarting] = useState(false)

    const start = useCallback(() => {
        setStarting(true)

        const hand = async (): Promise<void> => {
            try {
                await checker.download()
            } catch {
                setStarting(false)
            }
        }

        // The button stays busy after a successful hand-off on purpose: on the
        // desktop the browser has it now, and the app has nothing left to say.
        void hand()
    }, [checker])

    const value = useMemo<UpdatesApi>(
        () => ({ ...status, starting, start }),
        [status, starting, start],
    )

    return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>
}

export function useUpdates(): UpdatesApi {
    const api = useContext(UpdatesContext)

    if (api === null) {
        throw new Error('useUpdates must be used inside an UpdatesProvider')
    }

    return api
}
