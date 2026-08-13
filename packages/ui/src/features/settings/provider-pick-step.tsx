import { Check, ChevronRight } from 'lucide-react'
import { useCallback, useMemo, useState, type ChangeEvent } from 'react'

import { DialogDescription, DialogTitle } from '../../components/ui/dialog'
import { TextInput } from '../../components/ui/text-input'
import { cn } from '../../lib/cn'
import { KeyProviderMark } from './key-provider-mark'
import { KEY_PROVIDERS, type KeyProvider, type KeyProviderId } from './key-providers'

/**
 * Step one of adding a provider: a filterable list of everyone Umber can talk
 * to. Aggregators lead, since one of those keys covers the most ground, with the
 * individual vendors underneath.
 */

interface ProviderRowProps {
    readonly provider: KeyProvider
    readonly connected: boolean
    readonly onPick: (id: KeyProviderId) => void
}

function ProviderRow({ connected, onPick, provider }: ProviderRowProps) {
    const pick = useCallback(() => {
        onPick(provider.id)
    }, [onPick, provider.id])

    return (
        <button
            className={cn(
                'tint-control group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-start outline-none',
                'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                connected && 'pointer-events-none opacity-55',
            )}
            disabled={connected}
            onClick={pick}
            type="button"
        >
            <KeyProviderMark className="size-5 shrink-0 text-muted" provider={provider.id} />
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{provider.name}</span>
                <span className="block truncate text-xs text-muted">{provider.unlocks}</span>
            </span>
            {connected ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted">
                    <Check aria-hidden className="size-3.5 text-accent" />
                    Connected
                </span>
            ) : (
                <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted/50 transition-transform duration-150 group-hover:translate-x-0.5"
                />
            )}
        </button>
    )
}

interface ProviderGroupProps {
    readonly title: string
    readonly providers: readonly KeyProvider[]
    readonly connected: ReadonlySet<KeyProviderId>
    readonly onPick: (id: KeyProviderId) => void
}

function ProviderGroup({ connected, onPick, providers, title }: ProviderGroupProps) {
    if (providers.length === 0) {
        return null
    }

    return (
        <>
            <p className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                {title}
            </p>
            {providers.map((provider) => (
                <ProviderRow
                    connected={connected.has(provider.id)}
                    key={provider.id}
                    onPick={onPick}
                    provider={provider}
                />
            ))}
        </>
    )
}

function useProviderFilter() {
    const [query, setQuery] = useState('')

    const handleQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        setQuery(event.target.value)
    }, [])

    const { aggregators, vendors } = useMemo(() => {
        const needle = query.trim().toLowerCase()

        const matches =
            needle === ''
                ? KEY_PROVIDERS
                : KEY_PROVIDERS.filter(
                      (provider) =>
                          provider.name.toLowerCase().includes(needle) ||
                          provider.unlocks.toLowerCase().includes(needle),
                  )

        return {
            aggregators: matches.filter((provider) => provider.group === 'aggregator'),
            vendors: matches.filter((provider) => provider.group === 'vendor'),
        }
    }, [query])

    return { query, handleQueryChange, aggregators, vendors }
}

export interface PickStepProps {
    readonly connected: ReadonlySet<KeyProviderId>
    readonly onPick: (id: KeyProviderId) => void
}

export function PickStep({ connected, onPick }: PickStepProps) {
    const { aggregators, handleQueryChange, query, vendors } = useProviderFilter()

    return (
        <>
            <DialogTitle>Add a provider</DialogTitle>
            <DialogDescription>
                Pick a service you have an account with. You&rsquo;ll paste an API key from its
                console next.
            </DialogDescription>

            <TextInput
                aria-label="Filter providers"
                className="mt-4"
                onChange={handleQueryChange}
                placeholder="Filter by name or model…"
                value={query}
            />

            <div className="-mx-3 mt-3 min-h-0 flex-1 overflow-y-auto px-3 pb-1">
                <ProviderGroup
                    connected={connected}
                    onPick={onPick}
                    providers={aggregators}
                    title="One key, many models"
                />
                <ProviderGroup
                    connected={connected}
                    onPick={onPick}
                    providers={vendors}
                    title="Model vendors"
                />
                {aggregators.length === 0 && vendors.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-muted">
                        No provider matches &ldquo;{query.trim()}&rdquo;.
                    </p>
                ) : null}
            </div>
        </>
    )
}
