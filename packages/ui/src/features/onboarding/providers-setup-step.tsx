import { useCallback, useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
import { useKeys } from '../keys/keys-context'
import {
    findKeyProvider,
    KEY_PROVIDERS,
    type KeyProviderId,
    type NewConnection,
} from '../settings/key-providers'
import { ConfigureStep } from '../settings/provider-configure-step'
import { PickStep } from '../settings/provider-pick-step'

/**
 * The settings dialog's add-provider flow, sitting directly on the onboarding
 * page: the same two steps, in a panel of the same size, minus the dialog
 * around them. Connecting returns to the list — with the new row ticked — so
 * several keys can be added in one sitting, and the button under the panel
 * turns from a skip into a finish once anything is connected.
 */

/** The vault's connections, narrowed to ids this build's catalog knows. */
function useConnectedIds(): ReadonlySet<KeyProviderId> {
    const keys = useKeys()

    return useMemo(
        () =>
            new Set(
                KEY_PROVIDERS.filter((provider) => keys.connectedProviders.has(provider.id)).map(
                    (provider) => provider.id,
                ),
            ),
        [keys.connectedProviders],
    )
}

export interface ProvidersSetupStepProps {
    readonly onFinish: () => void
}

export function ProvidersSetupStep({ onFinish }: ProvidersSetupStepProps) {
    const keys = useKeys()
    const connected = useConnectedIds()
    const [picked, setPicked] = useState<KeyProviderId | null>(null)

    const back = useCallback(() => {
        setPicked(null)
    }, [])

    const connect = useCallback(
        async (connection: NewConnection) => {
            await keys.connect(connection.providerId, connection.credentials)
            setPicked(null)
        },
        [keys],
    )

    const anyConnected = connected.size > 0

    return (
        <div className="flex w-full max-w-md flex-col items-center px-6">
            {/* The dialog panel's height, shrunk before short windows clip it. */}
            <div className="glass-raised flex h-[min(37rem,calc(100vh-11rem))] w-full flex-col rounded-3xl p-6">
                {picked === null ? (
                    <PickStep connected={connected} onPick={setPicked} presentation="page" />
                ) : (
                    <ConfigureStep
                        onBack={back}
                        onConnect={connect}
                        presentation="page"
                        provider={findKeyProvider(picked)}
                    />
                )}
            </div>

            <Button
                className="mt-5 min-w-40"
                onClick={onFinish}
                variant={anyConnected ? 'primary' : 'ghost'}
            >
                {anyConnected ? 'Finish' : 'Skip for now'}
            </Button>
        </div>
    )
}
