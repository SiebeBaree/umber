import { useCallback, useMemo, useState } from 'react'

import { useKeys } from '../keys/keys-context'
import { AddProviderDialog } from '../settings/add-provider-dialog'
import { KEY_PROVIDERS, type NewConnection } from '../settings/key-providers'

/**
 * Templates renders on Google only, so instead of sending someone to Settings
 * it opens the same add-provider dialog straight on Google's form.
 */
export function useConnectGoogle() {
    const keys = useKeys()
    const [open, setOpen] = useState(false)

    const openDialog = useCallback(() => {
        setOpen(true)
    }, [])

    return {
        /** Null until the vault has answered. */
        connected: keys.ready ? keys.connectedProviders.has('google') : null,
        open,
        setOpen,
        openDialog,
    }
}

export function ConnectGoogleDialog({
    onOpenChange,
    open,
}: {
    readonly open: boolean
    readonly onOpenChange: (open: boolean) => void
}) {
    const keys = useKeys()

    const connect = useCallback(
        (connection: NewConnection) => keys.connect(connection.providerId, connection.credentials),
        [keys],
    )

    const connected = useMemo(
        () =>
            new Set(
                KEY_PROVIDERS.filter((provider) => keys.connectedProviders.has(provider.id)).map(
                    (provider) => provider.id,
                ),
            ),
        [keys.connectedProviders],
    )

    return (
        <AddProviderDialog
            connected={connected}
            onConnect={connect}
            onOpenChange={onOpenChange}
            open={open}
            provider="google"
        />
    )
}
