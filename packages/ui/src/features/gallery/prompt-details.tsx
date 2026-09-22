import { ArrowLeft, Check, ChevronRight, Copy } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

import { Button } from '../../components/ui/button'

function CopyPrompt({ prompt }: { readonly prompt: string }) {
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

    const copyPrompt = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(prompt)
            setCopyState('copied')
        } catch {
            setCopyState('failed')
        }
    }, [prompt])

    return (
        <div>
            <Button
                aria-label="Copy prompt"
                className="rounded-md px-0 text-xs"
                onClick={copyPrompt}
                size="sm"
                variant="ghost"
            >
                {copyState === 'copied' ? <Check aria-hidden /> : <Copy aria-hidden />}
                <span aria-live="polite">{copyState === 'copied' ? 'Copied' : 'Copy'}</span>
            </Button>
            {copyState === 'failed' ? (
                <output className="block text-xs text-muted">
                    Could not copy. Select the prompt and copy it manually.
                </output>
            ) : null}
        </div>
    )
}

/** One line keeps actions and version navigation steady across prompt lengths. */
export function PromptDetails({
    prompt,
    onRead,
    triggerId,
}: {
    readonly prompt: string
    readonly triggerId: string
    readonly onRead: () => void
}) {
    return (
        <div className="mt-4 min-w-0 shrink-0">
            <p className="truncate text-lg font-semibold leading-snug">{prompt}</p>
            <Button
                className="mt-2 rounded-md px-0 text-xs"
                id={triggerId}
                onClick={onRead}
                size="sm"
                variant="ghost"
            >
                Read prompt
                <ChevronRight aria-hidden />
            </Button>
        </div>
    )
}

function useReaderFocus(triggerId: string, onClose: () => void) {
    const reader = useRef<HTMLElement>(null)
    useLayoutEffect(() => {
        const trigger = document.querySelector(`[id="${triggerId}"]`)
        const button = reader.current?.querySelector('button')
        button?.focus()
        return () => {
            // Restore after the details become visible again, including in Strict Mode.
            queueMicrotask(() => {
                if (!button?.isConnected && trigger instanceof HTMLElement && trigger.isConnected) {
                    trigger.focus()
                }
            })
        }
    }, [triggerId])
    const onKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            event.stopPropagation()
            onClose()
        },
        [onClose],
    )
    return { reader, onKeyDown }
}

/** Read in place without changing the layout or losing the draft underneath. */
export function PromptReader({
    prompt,
    onClose,
    triggerId,
}: {
    readonly prompt: string
    readonly triggerId: string
    readonly onClose: () => void
}) {
    const { reader, onKeyDown } = useReaderFocus(triggerId, onClose)

    return (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape returns from this reader instead of closing the enclosing image dialog.
        <section
            ref={reader}
            aria-label="Prompt reader"
            className="flex min-h-0 flex-1 flex-col"
            onKeyDown={onKeyDown}
        >
            <Button className="self-start" onClick={onClose} size="sm" variant="ghost">
                <ArrowLeft aria-hidden />
                Back
            </Button>
            <h3 className="mt-6 shrink-0 text-xs text-muted">Prompt</h3>
            <div
                className="mt-3 min-h-0 overflow-y-auto"
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll long prompts.
                tabIndex={0}
            >
                <p
                    className="whitespace-pre-wrap text-lg font-semibold leading-relaxed [overflow-wrap:anywhere]"
                    aria-label="Full prompt"
                >
                    {prompt}
                </p>
                <div className="mt-4">
                    <CopyPrompt prompt={prompt} />
                </div>
            </div>
        </section>
    )
}
