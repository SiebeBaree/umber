import { Plus, Trash2 } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import { cn } from '../../lib/cn'
import { useKeys } from '../keys/keys-context'
import type { VaultConnection } from '../keys/vault'
import { AddProviderDialog } from './add-provider-dialog'
import { KeyProviderMark } from './key-provider-mark'
import {
    KEY_PROVIDERS,
    type KeyProvider,
    type KeyProviderId,
    type NewConnection,
} from './key-providers'

/**
 * The provider keys section: the connected list, or an empty state that earns
 * its space by explaining the whole model. Umber has no account of its own,
 * it runs on keys you bring.
 *
 * Connections live in the shell's vault via the keys context, so what is
 * listed here is exactly what the composer can generate with.
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

/** "13 Aug 2026" from the vault's ISO timestamp, or nothing if unparseable. */
function formatAddedOn(addedAt: string): string | null {
    const date = new Date(addedAt)

    if (Number.isNaN(date.getTime())) {
        return null
    }

    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

interface RowDetailsProps {
    readonly provider: KeyProvider
    readonly connection: VaultConnection
}

function RowDetails({ connection, provider }: RowDetailsProps) {
    const addedOn = formatAddedOn(connection.addedAt)

    return (
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
                {addedOn === null ? null : (
                    <>
                        <span aria-hidden>·</span>
                        <span>Added {addedOn}</span>
                    </>
                )}
            </p>
        </div>
    )
}

interface ConnectionRowProps extends RowDetailsProps {
    readonly onRemove: (providerId: KeyProviderId) => void
}

function ConnectionRow({ connection, onRemove, provider }: ConnectionRowProps) {
    const remove = useCallback(() => {
        onRemove(provider.id)
    }, [provider.id, onRemove])

    return (
        <li className="flex items-center gap-4 py-3.5">
            <div className="glass flex size-10 shrink-0 items-center justify-center rounded-xl">
                <KeyProviderMark className="size-5 text-ink" provider={provider.id} />
            </div>

            <RowDetails connection={connection} provider={provider} />

            <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted">
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

/** The vault spoken in this section's terms: joined rows plus the actions. */
function useProviderConnections() {
    const keys = useKeys()

    const connect = useCallback(
        (connection: NewConnection) => keys.connect(connection.providerId, connection.credentials),
        [keys],
    )

    const remove = useCallback(
        (providerId: KeyProviderId) => {
            void keys.remove(providerId)
        },
        [keys],
    )

    // Vault rows joined back to what is known about each provider; an id from
    // a newer build than this one is skipped rather than crashed on.
    const rows = useMemo(
        () =>
            keys.connections.flatMap((connection) => {
                const provider = KEY_PROVIDERS.find(
                    (candidate) => candidate.id === connection.providerId,
                )

                return provider === undefined ? [] : [{ provider, connection }]
            }),
        [keys.connections],
    )

    const connectedIds = useMemo(() => new Set(rows.map((row) => row.provider.id)), [rows])

    return { ready: keys.ready, rows, connectedIds, connect, remove }
}

export function ApiKeysSection() {
    const { connect, connectedIds, ready, remove, rows } = useProviderConnections()
    const [dialogOpen, setDialogOpen] = useState(false)

    const openDialog = useCallback(() => {
        setDialogOpen(true)
    }, [])

    return (
        <section aria-labelledby="settings-api-keys" className="glass rounded-3xl p-6">
            <SectionHeader onAdd={openDialog} showAdd={rows.length > 0} />

            {rows.length > 0 ? (
                <ul className="mt-3 divide-y divide-ink/[0.06]">
                    {rows.map(({ connection, provider }) => (
                        <ConnectionRow
                            connection={connection}
                            key={provider.id}
                            onRemove={remove}
                            provider={provider}
                        />
                    ))}
                </ul>
            ) : ready ? (
                <EmptyState onAdd={openDialog} />
            ) : (
                // The vault has not answered yet; a blank beat beats a flash of
                // the empty state on every visit.
                <div aria-hidden className="py-10" />
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
