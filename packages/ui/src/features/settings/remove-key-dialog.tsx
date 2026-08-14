import { useCallback, useRef } from 'react'

import { Button } from '../../components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/dialog'
import type { VaultConnection } from '../keys/vault'
import { KeyProviderMark } from './key-provider-mark'
import type { KeyProvider } from './key-providers'

/**
 * The question asked before a key leaves the vault.
 *
 * Removing one is not destructive the way deleting a picture is, the key still
 * exists at the provider, but it is a step that quietly switches off every
 * model behind it, and it is one small button away from the rest of the list.
 */

export interface RemoveKeyTarget {
    readonly provider: KeyProvider
    readonly connection: VaultConnection
}

export interface RemoveKeyDialogProps {
    /** The connection awaiting an answer, or null when none is. */
    readonly target: RemoveKeyTarget | null
    readonly onConfirm: () => void
    readonly onCancel: () => void
}

/** The provider this is about, named and shown by the tail of its key. */
function TargetCard({ target }: { readonly target: RemoveKeyTarget }) {
    return (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-ink/[0.03] px-4 py-3">
            <div className="glass flex size-9 shrink-0 items-center justify-center rounded-xl">
                <KeyProviderMark className="size-4 text-ink" provider={target.provider.id} />
            </div>
            <div className="min-w-0">
                <p className="truncate text-sm font-medium">{target.provider.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted">
                    ····{target.connection.keyTail}
                </p>
            </div>
        </div>
    )
}

/** Cancel first in the DOM, so the dialog opens with focus on the harmless one. */
function ConfirmActions({
    onCancel,
    onConfirm,
}: {
    readonly onConfirm: () => void
    readonly onCancel: () => void
}) {
    return (
        <div className="mt-5 flex justify-end gap-2">
            <Button onClick={onCancel} size="sm" variant="ghost">
                Cancel
            </Button>
            <Button
                className="text-rose-600 hover:text-rose-700"
                onClick={onConfirm}
                size="sm"
                variant="glass"
            >
                Remove key
            </Button>
        </div>
    )
}

export function RemoveKeyDialog({ onCancel, onConfirm, target }: RemoveKeyDialogProps) {
    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (!open) {
                onCancel()
            }
        },
        [onCancel],
    )

    /*
     * The panel keeps naming its provider right through the exit animation:
     * emptying it the moment the dialog closes would resize the panel
     * mid-flight. Written during render, which is safe because the same input
     * always produces the same value.
     */
    const lastShown = useRef<RemoveKeyTarget | null>(null)

    if (target !== null) {
        lastShown.current = target
    }

    const shown = target ?? lastShown.current

    return (
        <Dialog onOpenChange={handleOpenChange} open={target !== null}>
            <DialogContent className="max-w-sm" showClose={false}>
                <DialogTitle className="pe-0">Remove your {shown?.provider.name} key?</DialogTitle>
                <DialogDescription>
                    The key is erased from this device and its models stop working until you add one
                    again. The key itself stays valid at the provider.
                </DialogDescription>

                {shown === null ? null : <TargetCard target={shown} />}

                <ConfirmActions onCancel={onCancel} onConfirm={onConfirm} />
            </DialogContent>
        </Dialog>
    )
}
