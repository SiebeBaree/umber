import { type ChangeEvent, type KeyboardEvent, useCallback, useLayoutEffect, useRef } from 'react'

import type { PromptSuggestions } from './prompt-suggestions'
import { useTypedPlaceholder } from './use-typed-placeholder'

export interface PromptFieldProps {
    readonly value: string
    readonly onChange: (value: string) => void
    readonly onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
    readonly suggestions: PromptSuggestions
}

/**
 * The prompt input. Starts one line tall and grows only when the text actually
 * needs a second line, up to a cap, after which it scrolls — so an empty
 * composer carries no dead space above the toolbar.
 */
/**
 * Grows the field to fit its content.
 *
 * Reset to `auto` first, or `scrollHeight` reports the previous height and the
 * field could only ever grow. An empty field is left to the stylesheet rather
 * than measured: a textarea counts its *placeholder* in `scrollHeight`, so
 * measuring one would size the box to a wrapped suggestion the user never
 * typed — and on first paint, before flex has resolved the element's width,
 * that wrap is enormous.
 */
function useAutoGrow(value: string) {
    const fieldRef = useRef<HTMLTextAreaElement>(null)

    useLayoutEffect(() => {
        const field = fieldRef.current

        if (field === null) {
            return
        }

        field.style.height = 'auto'
        field.style.height = value === '' ? '' : `${field.scrollHeight}px`
    }, [value])

    return fieldRef
}

export function PromptField({ onChange, onKeyDown, suggestions, value }: PromptFieldProps) {
    const fieldRef = useAutoGrow(value)

    const placeholder = useTypedPlaceholder({
        prefix: suggestions.prefix,
        endings: suggestions.endings,
        enabled: value === '',
    })

    const handleChange = useCallback(
        (event: ChangeEvent<HTMLTextAreaElement>) => {
            onChange(event.target.value)
        },
        [onChange],
    )

    return (
        <>
            <label className="sr-only" htmlFor="composer-prompt">
                Prompt
            </label>
            <textarea
                className="max-h-40 min-h-9 flex-1 resize-none overflow-y-auto bg-transparent py-[0.4375rem] pe-2 text-[15px] leading-relaxed outline-none placeholder:text-muted"
                id="composer-prompt"
                onChange={handleChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                ref={fieldRef}
                rows={1}
                value={value}
            />
        </>
    )
}
