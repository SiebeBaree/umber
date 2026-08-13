import { Eye, EyeOff } from 'lucide-react'
import { useCallback, useState, type ChangeEvent } from 'react'

import { SegmentedControl } from '../../components/ui/segmented-control'
import { TextInput } from '../../components/ui/text-input'
import type { CredentialField } from './key-providers'

/**
 * One credential field of the add-provider form: label, the control a field of
 * that kind calls for, and its hint. The form itself just maps provider fields
 * through this.
 */

interface EnteredFieldProps {
    readonly field: Extract<CredentialField, { kind: 'secret' | 'text' }>
    readonly value: string
    readonly onChange: (value: string) => void
}

function SecretControl({ field, onChange, value }: EnteredFieldProps) {
    const [revealed, setRevealed] = useState(false)
    const Icon = revealed ? EyeOff : Eye

    const handleInput = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            onChange(event.target.value)
        },
        [onChange],
    )

    const toggle = useCallback(() => {
        setRevealed((current) => !current)
    }, [])

    return (
        <div className="relative">
            <TextInput
                autoComplete="off"
                className="pe-11 font-mono text-[13px]"
                id={field.id}
                onChange={handleInput}
                placeholder={field.placeholder}
                spellCheck={false}
                type={revealed ? 'text' : 'password'}
                value={value}
            />
            <button
                aria-label={revealed ? `Hide ${field.label}` : `Show ${field.label}`}
                aria-pressed={revealed}
                className="tint-control absolute top-1/2 end-1.5 flex size-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-muted outline-none hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                onClick={toggle}
                type="button"
            >
                <Icon aria-hidden className="size-4" />
            </button>
        </div>
    )
}

function TextControl({ field, onChange, value }: EnteredFieldProps) {
    const handleInput = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            onChange(event.target.value)
        },
        [onChange],
    )

    return (
        <TextInput
            autoComplete="off"
            id={field.id}
            onChange={handleInput}
            placeholder={field.placeholder}
            spellCheck={false}
            value={value}
        />
    )
}

export interface CredentialFieldControlProps {
    readonly field: CredentialField
    readonly value: string
    readonly onValueChange: (id: string, value: string) => void
}

export function CredentialFieldControl({
    field,
    onValueChange,
    value,
}: CredentialFieldControlProps) {
    const handleChange = useCallback(
        (next: string) => {
            onValueChange(field.id, next)
        },
        [field.id, onValueChange],
    )

    return (
        <div>
            {/* A choice control is not labellable with `htmlFor`; it carries an
                `aria-label` instead and the visible text is presentational. */}
            {field.kind === 'choice' ? (
                <p aria-hidden className="mb-1.5 text-[13px] font-medium">
                    {field.label}
                </p>
            ) : (
                <label className="mb-1.5 block text-[13px] font-medium" htmlFor={field.id}>
                    {field.label}
                </label>
            )}
            {field.kind === 'secret' ? (
                <SecretControl field={field} onChange={handleChange} value={value} />
            ) : field.kind === 'text' ? (
                <TextControl field={field} onChange={handleChange} value={value} />
            ) : (
                <SegmentedControl
                    aria-label={field.label}
                    onValueChange={handleChange}
                    options={field.options}
                    value={value}
                />
            )}
            {field.hint === undefined ? null : (
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{field.hint}</p>
            )}
        </div>
    )
}
