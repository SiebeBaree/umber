import { Trash2 } from 'lucide-react'
import { useCallback } from 'react'

import { Button } from '../../components/ui/button'
import { Tooltip } from '../../components/ui/tooltip'
import type { VaultConnection } from '../keys/vault'
import { KeyProviderMark } from './key-provider-mark'
import type { KeyProvider } from './key-providers'
import type { RemoveKeyTarget } from './remove-key-dialog'

/** One connected provider in the settings list: which key, and the way to drop it. */

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

export interface ConnectionRowProps extends RowDetailsProps {
    /** Asks for this key to go; the section puts the question up first. */
    readonly onRemove: (target: RemoveKeyTarget) => void
}

export function ConnectionRow({ connection, onRemove, provider }: ConnectionRowProps) {
    const remove = useCallback(() => {
        onRemove({ provider, connection })
    }, [provider, connection, onRemove])

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
