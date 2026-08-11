import { App } from '@umber/ui'
import { StrictMode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { expect, test } from 'vitest'

/**
 * The app mounts and paints. Both shells render this same component and nothing
 * else, so if this passes, both of them run.
 */
test('the app renders', () => {
    const container = document.createElement('div')
    document.body.append(container)

    flushSync(() => {
        createRoot(container).render(
            <StrictMode>
                <App platform="web" />
            </StrictMode>,
        )
    })

    expect(container.textContent).toContain('Hello, world!')
})
