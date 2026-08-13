import { useCallback, useEffect, useState } from 'react'

import { Dialog, DialogContent } from '../../components/ui/dialog'
import { findKeyProvider, type KeyProviderId, type NewConnection } from './key-providers'
import { ConfigureStep } from './provider-configure-step'
import { PickStep } from './provider-pick-step'

/**
 * The add-provider flow, in two steps inside one dialog: pick a provider, then
 * fill in exactly the credentials that provider declares. The configure step
 * checks the key live where it can; `onConnect` hands the credentials to the
 * vault and resolves once they are stored.
 */
export interface AddProviderDialogProps {
    readonly open: boolean
    readonly onOpenChange: (open: boolean) => void
    readonly connected: ReadonlySet<KeyProviderId>
    readonly onConnect: (connection: NewConnection) => Promise<void>
}

export function AddProviderDialog({
    connected,
    onConnect,
    onOpenChange,
    open,
}: AddProviderDialogProps) {
    const [picked, setPicked] = useState<KeyProviderId | null>(null)

    // A fresh open always starts at the picker; resetting on open rather than
    // on close keeps the panel's content stable during the exit animation.
    useEffect(() => {
        if (open) {
            setPicked(null)
        }
    }, [open])

    const back = useCallback(() => {
        setPicked(null)
    }, [])

    const connect = useCallback(
        async (connection: NewConnection) => {
            // Close only after the vault write lands; a failure surfaces in the
            // configure step, which stays open to show it.
            await onConnect(connection)
            onOpenChange(false)
        },
        [onConnect, onOpenChange],
    )

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            {/* A fixed height, so the panel doesn't resize between the two steps. */}
            <DialogContent className="h-[37rem]">
                {picked === null ? (
                    <PickStep connected={connected} onPick={setPicked} />
                ) : (
                    <ConfigureStep
                        onBack={back}
                        onConnect={connect}
                        provider={findKeyProvider(picked)}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}
