import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { cn } from '../../lib/cn'
import { AddProviderDialog } from './add-provider-dialog'
import { KeyProviderMark } from './key-provider-mark'
import {
    findKeyProvider,
    type KeyProviderId,
    type NewConnection,
    type ProviderConnection,
} from './key-providers'

/**
 * The provider keys section: the connected list, or an empty state that earns
 * its space by explaining the whole model. Umber has no account of its own,
 * it runs on keys you bring.
 *
 * Connections live in component state for now; nothing is persisted or
 * verified yet, but the full add/remove flow is walkable.
 */

/** The marks fanned out in the empty state, a hand of cards rather than a grid. */
const FANNED: readonly { readonly id: KeyProviderId; readonly tilt: string }[] = [
    { id: 'openai', tilt: '-rotate-12 translate-y-2' },
    { id: 'google', tilt: '-rotate-6 translate-y-0.5' },
    { id: 'blackForestLabs', tilt: 'rotate-0 -translate-y-0.5' },
    { id: 'kuaishou', tilt: 'rotate-6 translate-y-0.5' },
    { id: 'fal', tilt: 'rotate-12 translate-y-2' },
]

function EmptyState({ onAdd }: { readonly onAdd: () => void }) {
    return (
        <div className="flex flex-col items-center px-2 py-10 text-center">
            <div aria-hidden className="flex -space-x-2">
                {FANNED.map(({ id, tilt }) => (
                    <div
                        className={cn(
                            'glass-raised flex size-12 items-center justify-center rounded-2xl',
                            tilt,
                        )}
                        key={id}
                    >
                        <KeyProviderMark className="size-5 text-ink/70" provider={id} />
                    </div>
                ))}
            </div>

            <h3 className="mt-7 font-semibold">Bring your own keys</h3>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
                Umber calls each AI provider directly with an API key you own. Keys stay on this
                device and the provider bills you for exactly what you generate.
            </p>

            <Button className="mt-7" onClick={onAdd}>
                <Plus aria-hidden />
                Add your first provider
            </Button>
        </div>
    )
}

interface ConnectionRowProps {
    readonly connection: ProviderConnection
    readonly onRemove: (providerId: KeyProviderId) => void
}

function ConnectionRow({ connection, onRemove }: ConnectionRowProps) {
    const provider = findKeyProvider(connection.providerId)

    const remove = useCallback(() => {
        onRemove(connection.providerId)
    }, [connection.providerId, onRemove])

    return (
        <li className="flex items-center gap-4 py-3.5">
            <div className="glass flex size-10 shrink-0 items-center justify-center rounded-xl">
                <KeyProviderMark className="size-5 text-ink" provider={provider.id} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{provider.name}</span>
                    {provider.group === 'aggregator' ? (
                        <span className="rounded-full border border-ink/[0.08] px-1.5 py-px text-[10px] font-medium tracking-wide text-muted uppercase">
                            Aggregator
                        </span>
                    ) : null}
                </div>
                <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                    <span className="font-mono">····{connection.keyTail}</span>
                    <span aria-hidden>·</span>
                    <span>Added {connection.addedOn}</span>
                </p>
            </div>

            <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted">
                {/* Status is cosmetic until keys are actually verified. */}
                <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
                Connected
            </span>

            <Tooltip label={`Remove your ${provider.name} key`}>
                <Button
                    aria-label={`Remove your ${provider.name} key`}
                    onClick={remove}
                    size="icon-sm"
                    variant="ghost"
                >
                    <Trash2 aria-hidden />
                </Button>
            </Tooltip>
        </li>
    )
}

interface SectionHeaderProps {
    readonly showAdd: boolean
    readonly onAdd: () => void
}

function SectionHeader({ onAdd, showAdd }: SectionHeaderProps) {
    return (
        <div className="flex items-center justify-between gap-4">
            <h2 className="font-semibold" id="settings-api-keys">
                AI providers
            </h2>
            {showAdd ? (
                <Button onClick={onAdd} size="sm" variant="glass">
                    <Plus aria-hidden />
                    Add provider
                </Button>
            ) : null}
        </div>
    )
}

function useConnections() {
    const [connections, setConnections] = useState<readonly ProviderConnection[]>([])

    const connect = useCallback((connection: NewConnection) => {
        const addedOn = new Date().toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        })

        setConnections((current) => [...current, { ...connection, addedOn }])
    }, [])

    const remove = useCallback((providerId: KeyProviderId) => {
        setConnections((current) =>
            current.filter((connection) => connection.providerId !== providerId),
        )
    }, [])

    const connectedIds = useMemo(
        () => new Set(connections.map((connection) => connection.providerId)),
        [connections],
    )

    return { connections, connect, remove, connectedIds }
}

export function ApiKeysSection() {
    const { connect, connectedIds, connections, remove } = useConnections()
    const [dialogOpen, setDialogOpen] = useState(false)

    const openDialog = useCallback(() => {
        setDialogOpen(true)
    }, [])

    return (
        <section aria-labelledby="settings-api-keys" className="glass rounded-3xl p-6">
            <SectionHeader onAdd={openDialog} showAdd={connections.length > 0} />

            {connections.length === 0 ? (
                <EmptyState onAdd={openDialog} />
            ) : (
                <ul className="mt-3 divide-y divide-ink/[0.06]">
                    {connections.map((connection) => (
                        <ConnectionRow
                            connection={connection}
                            key={connection.providerId}
                            onRemove={remove}
                        />
                    ))}
                </ul>
            )}

            <AddProviderDialog
                connected={connectedIds}
                onConnect={connect}
                onOpenChange={setDialogOpen}
                open={dialogOpen}
            />
        </section>
    )
}
