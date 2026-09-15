import { Check, Copy } from 'lucide-react'
import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react'

import { Button } from '../../components/ui/button'

/** A bounded prompt reader. Copy always uses the original text, not the preview. */
function usePromptPreview(prompt: string) {
    const preview = useRef<HTMLParagraphElement>(null)
    const [expanded, setExpanded] = useState(false)
    const [truncated, setTruncated] = useState(false)

    useLayoutEffect(() => {
        const element = preview.current
        if (element === null || expanded) return

        const measure = () => setTruncated(element.scrollHeight > element.clientHeight + 1)
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [expanded, prompt])

    const toggle = useCallback(() => setExpanded((value) => !value), [])
    return { expanded, truncated, preview, toggle }
}

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

export function PromptDetails({ prompt }: { readonly prompt: string }) {
    const id = useId()
    const { expanded, truncated, preview, toggle } = usePromptPreview(prompt)

    return (
        <div className="mt-4 min-w-0">
            <p
                className={
                    expanded
                        ? 'hidden'
                        : 'line-clamp-4 whitespace-pre-wrap text-lg font-semibold leading-snug [overflow-wrap:anywhere]'
                }
                ref={preview}
            >
                {prompt}
            </p>
            <div className="mt-2 mb-3 flex items-center justify-between gap-3">
                {truncated ? (
                    <Button
                        aria-controls={id}
                        aria-expanded={expanded}
                        className="rounded-md px-0 text-xs"
                        onClick={toggle}
                        size="sm"
                        variant="ghost"
                    >
                        {expanded ? 'Read less' : 'Read more'}
                    </Button>
                ) : (
                    <span />
                )}
                <CopyPrompt prompt={prompt} />
            </div>
            <p
                className="max-h-[min(14rem,35vh)] overflow-y-auto whitespace-pre-wrap pe-2 text-[13px] leading-relaxed [overflow-wrap:anywhere]"
                hidden={!expanded}
                id={id}
                // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll the full prompt.
                tabIndex={expanded ? 0 : undefined}
                aria-label="Full prompt"
            >
                {prompt}
            </p>
        </div>
    )
}
