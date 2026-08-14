import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { z } from 'zod'

import { clearPersistedState, usePersistedState } from '../../lib/persisted-state'

/**
 * Who is using the app, as far as Umber cares to know: a first name, given
 * during onboarding and shown in the create page's greeting. Its absence is
 * what sends the app into onboarding, so erasing it *is* the reset switch.
 */

/** Bumped alongside a breaking change to the shape below, to drop stale entries. */
export const PROFILE_KEY = 'umber.profile.v1'

const profileSchema = z.object({ name: z.string().min(1) }).nullable()

export interface ProfileApi {
    /** Null until onboarding has been completed on this device. */
    readonly name: string | null
    readonly setName: (name: string) => void
    /** Forgets the profile entirely, which sends the app back to onboarding. */
    readonly clear: () => void
}

const ProfileContext = createContext<ProfileApi | null>(null)

export function ProfileProvider({ children }: { readonly children: ReactNode }) {
    const [profile, setProfile] = usePersistedState(PROFILE_KEY, profileSchema, null)

    const value = useMemo<ProfileApi>(
        () => ({
            name: profile?.name ?? null,
            setName: (name: string) => {
                setProfile({ name })
            },
            clear: () => {
                // The in-memory null makes the gate react now; removing the
                // stored entry makes the next launch agree with it.
                setProfile(null)
                clearPersistedState(PROFILE_KEY)
            },
        }),
        [profile, setProfile],
    )

    return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile(): ProfileApi {
    const api = useContext(ProfileContext)

    if (api === null) {
        throw new Error('useProfile must be used inside a ProfileProvider')
    }

    return api
}
