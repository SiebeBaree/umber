import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { NotificationsProvider } from '../packages/ui/src/features/notifications/notifications-context'
import { UpdateSection } from '../packages/ui/src/features/settings/update-section'
import type { UpdateChecker, UpdateStatus } from '../packages/ui/src/features/updates/checker'
import { UpdatesProvider } from '../packages/ui/src/features/updates/updates-context'

let root: Root
let container: HTMLDivElement
let receive: (status: UpdateStatus) => void
const unsubscribe = vi.fn()
const initial = () => Promise.resolve<UpdateStatus>({ state: 'idle', latestVersion: null })
let checker: UpdateChecker

beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    unsubscribe.mockClear()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    checker = {
        status: vi.fn(initial),
        check: vi.fn(() => Promise.resolve()),
        install: vi.fn(() => Promise.resolve()),
        onStatus: (listener) => {
            receive = listener
            return unsubscribe
        },
    }
})

afterEach(() => {
    act(() => root.unmount())
    container.remove()
})

async function mount() {
    await act(() => {
        root.render(
            <StrictMode>
                <NotificationsProvider>
                    <UpdatesProvider checker={checker}>
                        <UpdateSection />
                    </UpdatesProvider>
                </NotificationsProvider>
            </StrictMode>,
        )
    })
}

test('shows progress, restart and retry from main-process events without starting downloads', async () => {
    await mount()
    expect(container.textContent).toBe('')
    expect(checker.check).not.toHaveBeenCalled()
    act(() => receive({ state: 'downloading', latestVersion: '0.3.0', percent: 42 }))
    expect(container.textContent).toContain('Downloading 42%')
    expect(container.querySelector('button')).toBeNull()
    act(() => receive({ state: 'downloading', latestVersion: '0.3.0', percent: 100 }))
    expect(container.textContent).toContain('Preparing the update')
    act(() => receive({ state: 'ready', latestVersion: '0.3.0' }))
    expect(container.textContent).toContain('Restart to update')
    await act(() => container.querySelector('button')?.click())
    expect(checker.install).toHaveBeenCalledOnce()
    act(() => receive({ state: 'installing', latestVersion: '0.3.0' }))
    expect(container.querySelector('button')).toBeNull()
    act(() => receive({ state: 'error', latestVersion: '0.3.0', message: 'Try again.' }))
    expect(container.textContent).toContain('Update interrupted')
    await act(() => container.querySelector('button')?.click())
    expect(checker.check).toHaveBeenCalledOnce()
})

test('a late snapshot cannot overwrite a newer event and subscriptions are cleaned up', async () => {
    let resolveSnapshot: ((status: UpdateStatus) => void) | undefined
    const snapshot = new Promise<UpdateStatus>((resolve) => {
        resolveSnapshot = resolve
    })
    checker.status = () => snapshot
    await mount()
    act(() => receive({ state: 'ready', latestVersion: '0.3.0' }))
    await act(() => resolveSnapshot?.({ state: 'idle', latestVersion: null }))
    expect(container.textContent).toContain('Umber 0.3.0 is ready')
    act(() => root.unmount())
    // StrictMode's initial cleanup plus the real unmount.
    expect(unsubscribe).toHaveBeenCalledTimes(2)
})
