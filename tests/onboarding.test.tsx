import { App } from '@umber/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, test, vi } from 'vitest'

// Reached by path rather than through `@umber/ui`: the storage key is an
// internal of the profile feature, and seeding it should not force it into
// the package's public surface.
import { PROFILE_KEY } from '../packages/ui/src/features/profile/profile-context'

/**
 * The first-run gate: no stored name means onboarding over an inert app, a
 * stored name means straight to the create page, greeting included.
 */

beforeEach(() => {
    localStorage.clear()
})

function mount(): HTMLDivElement {
    const container = document.createElement('div')
    document.body.append(container)

    createRoot(container).render(
        <StrictMode>
            <App />
        </StrictMode>,
    )

    return container
}

test('a fresh install opens in onboarding, over an inert app', async () => {
    const container = mount()

    await vi.waitFor(() => {
        expect(container.textContent).toContain('Welcome')
    })

    // The app stays mounted underneath, but nothing in it can be reached.
    await vi.waitFor(() => {
        expect(container.querySelector('div[inert]')).not.toBeNull()
    })
})

test('a stored name skips onboarding and greets on the create page', async () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: 'Robin' }))
    const container = mount()

    await vi.waitFor(() => {
        expect(container.querySelector('form[aria-label="Create with AI"]')).not.toBeNull()
    })

    expect(container.querySelector('div[inert]')).toBeNull()

    await vi.waitFor(() => {
        expect(container.textContent).toContain('Welcome back, Robin')
    })
})
