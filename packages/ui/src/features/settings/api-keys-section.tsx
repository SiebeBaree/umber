import { Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
import { cn } from '../../lib/cn'
import { ProviderMark } from '../create/catalog'
import { useKeys } from '../keys/keys-context'
import { AddProviderDialog } from './add-provider-dialog'
import { ConnectionRow } from './connection-row'
import { KEY_PROVIDERS, type KeyProviderId, type NewConnection } from './key-providers'
import { RemoveKeyDialog, type RemoveKeyTarget } from './remove-key-dialog'

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
    { id: 'runway', tilt: 'rotate-12 translate-y-2' },
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
                        <ProviderMark className="size-5 text-ink/70" provider={id} />
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

/**
 * Removing, with the question in front of it: a request parks the connection
 * until the dialog comes back with an answer.
 */
function useRemovalFlow(remove: (providerId: KeyProviderId) => void) {
    const [target, setTarget] = useState<RemoveKeyTarget | null>(null)

    const cancel = useCallback(() => {
        setTarget(null)
    }, [])

    const confirm = useCallback(() => {
        if (target !== null) {
            remove(target.provider.id)
        }

        setTarget(null)
    }, [target, remove])

    return { target, request: setTarget, confirm, cancel }
}

export function ApiKeysSection() {
    const { connect, connectedIds, ready, remove, rows } = useProviderConnections()
    const [dialogOpen, setDialogOpen] = useState(false)
    const removal = useRemovalFlow(remove)

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
                            onRemove={removal.request}
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

            <RemoveKeyDialog
                onCancel={removal.cancel}
                onConfirm={removal.confirm}
                target={removal.target}
            />
        </section>
    )
}
