import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * The app's notices: short, plain-spoken cards in the top corner that stay put
 * until they are dismissed.
 *
 * Nothing here expires on a timer. A notice exists because something the user
 * asked for did not happen, and a message about a failed run that vanishes
 * while they were looking elsewhere is worse than no message at all.
 */

export interface AppNotification {
    readonly id: string
    /** One short line: what happened, in the user's terms. */
    readonly title: string
    /** Why it happened and what to do about it, in plain words. */
    readonly body: string
}

export interface NotificationsApi {
    readonly notifications: readonly AppNotification[]
    readonly notify: (title: string, body: string) => void
    readonly dismiss: (id: string) => void
}

const NotificationsContext = createContext<NotificationsApi | null>(null)

/**
 * How many notices are kept. Nothing dismisses itself, so a long session with a
 * flaky provider would otherwise stack cards down past the bottom of the window;
 * the oldest goes as the newest arrives.
 */
const MAX_KEPT = 4

export function NotificationsProvider({ children }: { readonly children: ReactNode }) {
    const [notifications, setNotifications] = useState<readonly AppNotification[]>([])

    const notify = useCallback((title: string, body: string) => {
        setNotifications((current) =>
            [...current, { id: crypto.randomUUID(), title, body }].slice(-MAX_KEPT),
        )
    }, [])

    const dismiss = useCallback((id: string) => {
        setNotifications((current) => current.filter((notification) => notification.id !== id))
    }, [])

    const value = useMemo<NotificationsApi>(
        () => ({ notifications, notify, dismiss }),
        [notifications, notify, dismiss],
    )

    return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotifications(): NotificationsApi {
    const api = useContext(NotificationsContext)

    if (api === null) {
        throw new Error('useNotifications must be used inside a NotificationsProvider')
    }

    return api
}
