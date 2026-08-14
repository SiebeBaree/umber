import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'

import { Button } from '../../components/ui/button'
import { TextInput } from '../../components/ui/text-input'

/**
 * The one question onboarding insists on: a first name for the create page to
 * greet. Everything else about the flow can be skipped; this cannot, because
 * a greeting with a blank in it is worse than no greeting.
 */

/**
 * Focused from an effect rather than `autoFocus`: the attribute fires the
 * instant the element mounts, which on this screen is mid-entrance — the
 * field is still travelling and blurred when the caret lands in it.
 */
function useEntranceFocus() {
    const ref = useRef<HTMLInputElement>(null)

    useEffect(() => {
        ref.current?.focus()
    }, [])

    return ref
}

export interface NameStepProps {
    readonly onSubmit: (name: string) => void
}

export function NameStep({ onSubmit }: NameStepProps) {
    const [draft, setDraft] = useState('')
    const trimmed = draft.trim()
    const inputRef = useEntranceFocus()

    const onDraftChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setDraft(event.target.value)
    }, [])

    const submit = useCallback(
        (event: FormEvent) => {
            event.preventDefault()

            if (trimmed !== '') {
                onSubmit(trimmed)
            }
        },
        [trimmed, onSubmit],
    )

    return (
        <form className="flex w-full max-w-sm flex-col items-center px-6" onSubmit={submit}>
            <h1 className="text-center text-4xl font-semibold tracking-tight text-balance">
                What should we call you?
            </h1>
            <p className="mt-3 text-center text-sm leading-relaxed text-muted">
                Just a first name. It stays on this device.
            </p>

            <TextInput
                aria-label="Your first name"
                autoComplete="off"
                className="mt-8 max-w-xs text-center"
                onChange={onDraftChange}
                placeholder="Your first name"
                ref={inputRef}
                spellCheck={false}
                value={draft}
            />
            <Button className="mt-4 w-full max-w-xs" disabled={trimmed === ''} type="submit">
                Continue
            </Button>
        </form>
    )
}
