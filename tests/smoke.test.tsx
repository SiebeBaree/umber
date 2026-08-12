import { App } from '@umber/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, test, vi } from 'vitest'

/**
 * The app mounts and paints its home page. The desktop shell renders this same
 * component and nothing else, so if this passes, the app runs.
 *
 * Asserts on the composer rather than the heading: the heading cycles between
 * two lines, so which one is on screen depends on timing.
 */
test('the app renders the create page', async () => {
    const container = document.createElement('div')
    document.body.append(container)

    createRoot(container).render(
        <StrictMode>
            <App />
        </StrictMode>,
    )

    // The router resolves its first match asynchronously, so poll for paint.
    await vi.waitFor(() => {
        expect(container.querySelector('form[aria-label="Create with AI"]')).not.toBeNull()
    })
})
