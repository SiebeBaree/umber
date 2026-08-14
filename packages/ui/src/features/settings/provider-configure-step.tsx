import {
    ArrowLeft,
    ArrowUpRight,
    Info,
    LoaderCircle,
    ShieldCheck,
    TriangleAlert,
} from 'lucide-react'
import { useCallback, useState, type FormEvent } from 'react'

import { Button } from '../../components/ui/button'
import { DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { cn } from '../../lib/cn'
import { ProviderMark } from '../create/catalog'
import { CredentialFieldControl } from './credential-fields'
import type { KeyProvider, NewConnection, SetupStep } from './key-providers'
import { useConnectCheck, type CheckState } from './use-connect-check'

/**
 * Step two of adding a provider: everything to do in the provider's console,
 * numbered, then the paste field. On connect the credentials are checked live
 * where a checker exists, so a bad key fails here — with a reason — rather
 * than at the first generation.
 */

function ConfigureHeader({
    onBack,
    provider,
}: {
    readonly provider: KeyProvider
    readonly onBack: () => void
}) {
    // "The FLUX image family" reads as mid-sentence here: "Unlocks the FLUX…".
    // Only a leading article is folded; everything else is a proper noun.
    const unlocks = provider.unlocks.startsWith('The ')
        ? `the ${provider.unlocks.slice(4)}`
        : provider.unlocks

    return (
        <div className="flex items-center gap-3 pe-8">
            <Button
                aria-label="Back to all providers"
                onClick={onBack}
                size="icon-sm"
                variant="ghost"
            >
                <ArrowLeft aria-hidden />
            </Button>
            <div className="glass flex size-10 shrink-0 items-center justify-center rounded-xl">
                <ProviderMark className="size-5 text-ink" provider={provider.id} />
            </div>
            <div className="min-w-0">
                <DialogTitle className="pe-0 text-base">Connect {provider.name}</DialogTitle>
                <DialogDescription className="mt-0 truncate text-xs">
                    Unlocks {unlocks}
                </DialogDescription>
            </div>
        </div>
    )
}

/** One console task. The whole row is the link when the step carries one. */
function SetupStepRow({ index, step }: { readonly index: number; readonly step: SetupStep }) {
    const body = (
        <>
            <span
                aria-hidden
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-[11px] font-semibold text-muted"
            >
                {index + 1}
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{step.title}</span>
                <span className="mt-0.5 block text-xs leading-snug font-normal text-muted">
                    {step.detail}
                </span>
            </span>
            {step.url === undefined ? null : (
                <ArrowUpRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
            )}
        </>
    )

    if (step.url === undefined) {
        return <div className="flex items-start gap-3 rounded-xl px-3 py-2">{body}</div>
    }

    return (
        <a
            className="glass-control flex items-start gap-3 rounded-xl px-3 py-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href={step.url}
            rel="noreferrer"
            target="_blank"
        >
            {body}
        </a>
    )
}

function SectionLabel({ children }: { readonly children: string }) {
    return (
        <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{children}</p>
    )
}

/** The single "open the console" step derived for providers without a list. */
function derivedSetup(provider: KeyProvider): readonly SetupStep[] {
    return [
        {
            title: `Open ${provider.console.label}`,
            detail: 'Create a key there, then copy it. Opens in your browser.',
            url: provider.console.url,
        },
    ]
}

interface CredentialFormProps {
    readonly provider: KeyProvider
    readonly values: Readonly<Record<string, string>>
    readonly onValueChange: (id: string, value: string) => void
}

function CredentialForm({ onValueChange, provider, values }: CredentialFormProps) {
    const steps = provider.setup ?? derivedSetup(provider)

    return (
        <div className="-mx-1 mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-1">
            <div>
                <SectionLabel>Get set up</SectionLabel>
                <div className="mt-2 space-y-2">
                    {steps.map((step, index) => (
                        <SetupStepRow index={index} key={step.title} step={step} />
                    ))}
                </div>
            </div>

            <div>
                <SectionLabel>Then paste it here</SectionLabel>
                <div className="mt-2 space-y-4">
                    {provider.fields.map((field) => (
                        <CredentialFieldControl
                            field={field}
                            key={field.id}
                            onValueChange={onValueChange}
                            value={values[field.id] ?? ''}
                        />
                    ))}
                </div>
            </div>

            {provider.note === undefined ? null : (
                <p className="flex gap-2 text-xs leading-relaxed text-muted">
                    <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    {provider.note}
                </p>
            )}
        </div>
    )
}

function CheckNotice({ state }: { readonly state: CheckState }) {
    if (state.phase !== 'failed' && state.phase !== 'unverified') {
        return null
    }

    const failed = state.phase === 'failed'

    return (
        <p
            className={cn(
                'mb-3 flex gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed',
                failed
                    ? 'border-rose-500/25 bg-rose-500/10 text-rose-900'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-900',
            )}
            role={failed ? 'alert' : 'status'}
        >
            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {state.message}
        </p>
    )
}

function ConnectFooter({
    check,
    disabled,
    provider,
}: {
    readonly provider: KeyProvider
    readonly disabled: boolean
    readonly check: CheckState
}) {
    const checking = check.phase === 'checking'

    return (
        <div className="mt-5 border-t border-ink/[0.07] pt-4">
            <CheckNotice state={check} />
            <p className="flex gap-2 text-xs leading-relaxed text-muted">
                <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                Your key stays on this device and is only sent to {provider.name} when you generate.{' '}
                {provider.name} bills you directly for what you use.
            </p>
            <Button className="mt-4 w-full" disabled={disabled || checking} type="submit">
                {checking ? (
                    <>
                        <LoaderCircle aria-hidden className="animate-spin" />
                        Checking your key
                    </>
                ) : check.phase === 'unverified' ? (
                    'Connect anyway'
                ) : (
                    `Connect ${provider.name}`
                )}
            </Button>
        </div>
    )
}

export interface ConfigureStepProps {
    readonly provider: KeyProvider
    readonly onBack: () => void
    readonly onConnect: (connection: NewConnection) => Promise<void>
}

export function ConfigureStep({ onBack, onConnect, provider }: ConfigureStepProps) {
    // Text and secret fields start empty; a choice field starts on its first
    // option, because "no region picked" is not a state the form offers.
    const [values, setValues] = useState<Readonly<Record<string, string>>>(() =>
        Object.fromEntries(
            provider.fields.map((field) => [
                field.id,
                field.kind === 'choice' ? field.options[0].value : '',
            ]),
        ),
    )
    const { check, connect, invalidate } = useConnectCheck(provider, onConnect)

    const setValue = useCallback(
        (id: string, value: string) => {
            setValues((current) => ({ ...current, [id]: value }))
            // A fresh edit invalidates whatever the last check concluded.
            invalidate()
        },
        [invalidate],
    )

    const complete = provider.fields.every((field) => (values[field.id] ?? '').trim() !== '')

    const submit = useCallback(
        (event: FormEvent) => {
            event.preventDefault()

            if (complete) {
                void connect(
                    Object.fromEntries(
                        Object.entries(values).map(([id, value]) => [id, value.trim()]),
                    ),
                )
            }
        },
        [complete, connect, values],
    )

    return (
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
            <ConfigureHeader onBack={onBack} provider={provider} />
            <CredentialForm onValueChange={setValue} provider={provider} values={values} />
            <ConnectFooter check={check} disabled={!complete} provider={provider} />
        </form>
    )
}
