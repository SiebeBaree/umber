import type { ReactNode } from 'react'

import { GenerationProvider } from './features/generate/generation-context'
import { KeysProvider } from './features/keys/keys-context'
import type { KeyVault } from './features/keys/vault'
import { NotificationsProvider } from './features/notifications/notifications-context'
import { ProfileProvider } from './features/profile/profile-context'
import { UpdatesProvider, type UpdateChecker } from './features/updates/updates-context'

/**
 * Everything the app reads from context, in the one order it can be built in.
 *
 * Nesting is the point of this file, so it is worth stating: keys come first
 * because a run needs one, notifications wrap generation because a run that
 * fails has nowhere else to say so, and updates sit innermost because nothing
 * else depends on them.
 */
export function AppProviders({
    children,
    updates,
    vault,
}: {
    readonly children: ReactNode
    readonly updates: UpdateChecker | undefined
    readonly vault: KeyVault | undefined
}) {
    return (
        <KeysProvider vault={vault}>
            <ProfileProvider>
                <NotificationsProvider>
                    <GenerationProvider>
                        <UpdatesProvider checker={updates}>{children}</UpdatesProvider>
                    </GenerationProvider>
                </NotificationsProvider>
            </ProfileProvider>
        </KeysProvider>
    )
}
