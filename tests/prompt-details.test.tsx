import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { PromptDetails } from '../packages/ui/src/features/gallery/prompt-details'

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
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            disconnect() {}
        },
    )
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100)
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(300)
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

test('expands long prompts and copies the exact text in either state', async () => {
    const prompt = 'First paragraph.\n\n  Keep this indentation.\n' + 'A long prompt. '.repeat(80)
    act(() => root.render(<PromptDetails prompt={prompt} />))
    expect(button('Read more').getAttribute('aria-expanded')).toBe('false')
    await act(async () => {
        button('Copy prompt').click()
        await Promise.resolve()
    })
    expect(writeText).toHaveBeenLastCalledWith(prompt)
    act(() => button('Read more').click())
    expect(button('Read less').getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[aria-label="Full prompt"]')?.textContent).toBe(prompt)
    await act(async () => {
        button('Copy prompt').click()
        await Promise.resolve()
    })
    expect(writeText).toHaveBeenCalledTimes(2)
    expect(writeText).toHaveBeenLastCalledWith(prompt)
    act(() => button('Read less').click())
    expect(button('Read more').getAttribute('aria-expanded')).toBe('false')
})

test('short prompts stay readable without an expansion control and copy errors are reported', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(100)
    act(() => root.render(<PromptDetails prompt="A lighthouse" />))
    expect(container.querySelector('[aria-expanded]')).toBeNull()
    writeText.mockRejectedValueOnce(new Error('Permission denied'))
    await act(async () => {
        button('Copy prompt').click()
        await Promise.resolve()
    })
    expect(container.querySelector('output')?.textContent).toContain('Could not copy')
    expect(button('Copy prompt').textContent).toBe('Copy')
})
