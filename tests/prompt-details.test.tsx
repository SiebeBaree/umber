import { act, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { PromptDetails, PromptReader } from '../packages/ui/src/features/gallery/prompt-details'

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
const writeText = vi.fn<(text: string) => Promise<void>>()

beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    writeText.mockReset().mockImplementation(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })
})

afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    globalThis.IS_REACT_ACT_ENVIRONMENT = false
})

function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find(
        (element) => element.textContent === label || element.getAttribute('aria-label') === label,
    )
    if (!found) throw new Error(`Missing button: ${label}`)
    return found
}

function PromptHarness({ prompt }: { readonly prompt: string }) {
    const [reading, setReading] = useState(false)
    const open = useCallback(() => setReading(true), [])
    const close = useCallback(() => setReading(false), [])
    return (
        <>
            <div hidden={reading}>
                <PromptDetails triggerId="read-prompt" prompt={prompt} onRead={open} />
            </div>
            {reading ? (
                <PromptReader triggerId="read-prompt" prompt={prompt} onClose={close} />
            ) : null}
        </>
    )
}

test('reads and copies the exact prompt, then restores focus without closing details', async () => {
    const prompt = 'First paragraph.\n\n  Keep this indentation.\n' + 'A long prompt. '.repeat(80)
    act(() => root.render(<PromptHarness prompt={prompt} />))
    act(() => {
        button('Read prompt').focus()
        button('Read prompt').click()
    })
    expect(document.activeElement).toBe(button('Back'))
    expect(container.querySelector('[aria-label="Full prompt"]')?.textContent).toBe(prompt)
    await act(async () => {
        button('Copy prompt').click()
        await Promise.resolve()
    })
    expect(writeText).toHaveBeenLastCalledWith(prompt)
    const outerEscape = vi.fn()
    document.addEventListener('keydown', outerEscape)
    await act(async () => {
        button('Back').dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
        )
        await new Promise((resolve) => {
            setTimeout(resolve, 10)
        })
    })
    document.removeEventListener('keydown', outerEscape)
    expect(outerEscape).not.toHaveBeenCalled()
    expect(container.querySelector('[aria-label="Full prompt"]')).toBeNull()
    expect(document.activeElement).toBe(button('Read prompt'))
})

test('opens short prompts too and reports copy errors', async () => {
    act(() => root.render(<PromptHarness prompt="A lighthouse" />))
    act(() => button('Read prompt').click())
    writeText.mockRejectedValueOnce(new Error('Permission denied'))
    await act(async () => {
        button('Copy prompt').click()
        await Promise.resolve()
    })
    expect(container.querySelector('output')?.textContent).toContain('Could not copy')
    expect(button('Copy prompt').textContent).toBe('Copy')
    act(() => button('Back').click())
    expect(container.querySelector('[aria-label="Full prompt"]')).toBeNull()
})
