import { useCallback, useEffect, useState } from 'react'

import { Dialog, DialogContent } from '../../components/ui/dialog'
import { findKeyProvider, type KeyProviderId, type NewConnection } from './key-providers'
import { ConfigureStep } from './provider-configure-step'
import { PickStep } from './provider-pick-step'

/**
 * The add-provider flow, in two steps inside one dialog: pick a provider, then
 * fill in exactly the credentials that provider declares. Nothing is verified
 * or stored yet. "Connecting" hands the parent a display-safe summary and the
 * secrets themselves are dropped on the floor.
 */
export interface AddProviderDialogProps {
    readonly open: boolean
    readonly onOpenChange: (open: boolean) => void
    readonly connected: ReadonlySet<KeyProviderId>
    readonly onConnect: (connection: NewConnection) => void
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
        (connection: NewConnection) => {
            onConnect(connection)
            onOpenChange(false)
        },
        [onConnect, onOpenChange],
    )

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            {/* A fixed height, so the panel doesn't resize between the two steps. */}
            <DialogContent className="h-[34rem]">
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
