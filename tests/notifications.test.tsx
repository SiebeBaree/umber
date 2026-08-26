import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, test } from 'vitest'

import {
    NotificationsProvider,
    useNotifications,
    type NotificationsApi,
} from '../packages/ui/src/features/notifications/notifications-context'

/**
 * The notice store: nothing expires on its own, and the column never outgrows
 * the corner it lives in.
 */

const store: { api: NotificationsApi | null } = { api: null }

function Probe() {
    store.api = useNotifications()

    return null
}

function api(): NotificationsApi {
    if (store.api === null) {
        throw new Error('the probe never mounted')
    }

    return store.api
}

function mount() {
    const container = document.createElement('div')
    document.body.append(container)

    act(() => {
        createRoot(container).render(
            <StrictMode>
                <NotificationsProvider>
                    <Probe />
                </NotificationsProvider>
            </StrictMode>,
        )
    })
}

function notify(title: string) {
    act(() => {
        api().notify(title, 'why it happened')
    })
}

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean
}

beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    store.api = null
})

test('a notice stays until it is dismissed', () => {
    mount()

    notify('Your image didn’t come out')

    const notice = api().notifications[0]

    expect(notice?.title).toBe('Your image didn’t come out')

    act(() => {
        api().dismiss(notice?.id ?? '')
    })

    expect(api().notifications).toEqual([])
})

test('the column never grows past what fits in the corner', () => {
    mount()

    for (const title of ['first', 'second', 'third', 'fourth', 'fifth']) {
        notify(title)
    }

    // Oldest first out, newest kept: the last thing that went wrong is the one
    // still worth reading.
    expect(api().notifications.map((notice) => notice.title)).toEqual([
        'second',
        'third',
        'fourth',
        'fifth',
    ])
})
