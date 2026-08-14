import { useCallback } from 'react'

import { clearPersistedState } from '../../lib/persisted-state'
import { COMPOSER_SETTINGS_KEY } from '../create/settings/schema'
import { clearCreations } from '../gallery/creations-db'
import { useGeneration } from '../generate/generation-context'
import { useKeys } from '../keys/keys-context'
import { useProfile } from '../profile/profile-context'

/**
 * Everything Umber keeps on this device, erased in one go: the gallery, the
 * provider keys, the composer's remembered choices, and the name from
 * onboarding. Nothing is sent anywhere and nothing is kept elsewhere, so this
 * really is the whole of it.
 *
 * The order runs from the heaviest to the lightest, so a failure part-way
 * leaves the smallest possible mess behind. The profile goes last: its absence
 * is what drops the app back into onboarding, so by the time the flow appears
 * the erase is already complete.
 */
export function useEraseEverything(): () => Promise<void> {
    const keys = useKeys()
    const generation = useGeneration()
    const profile = useProfile()

    return useCallback(async () => {
        await clearCreations()

        // One provider at a time: the vault rewrites its whole file per
        // removal, so two in flight together would each write back a copy
        // without the other's change, and a key would survive the erase.
        await keys.connections.reduce(
            (queue, connection) => queue.then(() => keys.remove(connection.providerId)),
            Promise.resolve(),
        )

        clearPersistedState(COMPOSER_SETTINGS_KEY)

        // The create page draws its last run from memory rather than from the
        // gallery; those files are gone now, so the stage goes with them.
        generation.reset()

        profile.clear()
    }, [keys, generation, profile])
}
