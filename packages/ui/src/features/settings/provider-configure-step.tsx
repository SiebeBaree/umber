import { ArrowLeft, ArrowUpRight, Info, ShieldCheck } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '../../components/ui/button'
import { DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { CredentialFieldControl } from './credential-fields'
import { KeyProviderMark } from './key-provider-mark'
import type { KeyProvider, NewConnection } from './key-providers'

/**
 * Step two of adding a provider: get the key, paste the key. The two acts are
 * numbered in the form itself so it is unmistakable that the key is created in
 * the provider's console and Umber merely receives it.
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
                <KeyProviderMark className="size-5 text-ink" provider={provider.id} />
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

function ConsoleLink({ provider }: { readonly provider: KeyProvider }) {
    return (
        <a
            className="glass-control mt-2 flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href={provider.console.url}
            rel="noreferrer"
            target="_blank"
        >
            <span>
                Open {provider.console.label}
                <span className="mt-0.5 block text-xs font-normal text-muted">
                    Create a key there, then copy it. Opens in your browser.
                </span>
            </span>
            <ArrowUpRight aria-hidden className="size-4 shrink-0 text-muted" />
        </a>
    )
}

interface CredentialFormProps {
    readonly provider: KeyProvider
    readonly values: Readonly<Record<string, string>>
    readonly onValueChange: (id: string, value: string) => void
}

function CredentialForm({ onValueChange, provider, values }: CredentialFormProps) {
    return (
        <div className="-mx-1 mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-1">
            <div>
                <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                    Step 1 · Get your key
                </p>
                <ConsoleLink provider={provider} />
            </div>

            <div>
                <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                    Step 2 · Paste it here
                </p>
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

function ConnectFooter({
    disabled,
    onConnect,
    provider,
}: {
    readonly provider: KeyProvider
    readonly disabled: boolean
    readonly onConnect: () => void
}) {
    return (
        <div className="mt-5 border-t border-ink/[0.07] pt-4">
            <p className="flex gap-2 text-xs leading-relaxed text-muted">
                <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                Your key stays on this device and is only sent to {provider.name} when you generate.{' '}
                {provider.name} bills you directly for what you use.
            </p>
            <Button className="mt-4 w-full" disabled={disabled} onClick={onConnect}>
                Connect {provider.name}
            </Button>
        </div>
    )
}

export interface ConfigureStepProps {
    readonly provider: KeyProvider
    readonly onBack: () => void
    readonly onConnect: (connection: NewConnection) => void
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

    const setValue = useCallback((id: string, value: string) => {
        setValues((current) => ({ ...current, [id]: value }))
    }, [])

    const complete = provider.fields.every((field) => (values[field.id] ?? '').trim() !== '')

    const connect = useCallback(() => {
        const primary = (values[provider.fields[0].id] ?? '').trim()
        onConnect({ providerId: provider.id, keyTail: primary.slice(-4) })
    }, [onConnect, provider, values])

    return (
        <>
            <ConfigureHeader onBack={onBack} provider={provider} />
            <CredentialForm onValueChange={setValue} provider={provider} values={values} />
            <ConnectFooter disabled={!complete} onConnect={connect} provider={provider} />
        </>
    )
}
