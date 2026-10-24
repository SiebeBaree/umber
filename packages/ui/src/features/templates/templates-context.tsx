import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'

import { clearPersistedState } from '../../lib/persisted-state'
import { TEMPLATES_PREFS_KEY } from './template-prefs'
import { useTemplateSet, type TemplateSetApi } from './use-template-set'
import { useYouPhotos, type YouPhotosApi } from './use-you-photos'

/**
 * Templates' state, held above the router so a set keeps rendering and stays
 * put while the user looks at the gallery and comes back.
 */
export interface TemplatesApi extends TemplateSetApi {
    readonly you: YouPhotosApi
    /** Forgets the photos, the set and the remembered choices. For Erase all data. */
    readonly erase: () => Promise<void>
}

const TemplatesContext = createContext<TemplatesApi | null>(null)

export function TemplatesProvider({ children }: { readonly children: ReactNode }) {
    const you = useYouPhotos()
    const templateSet = useTemplateSet(you.photos)
    const { reset } = templateSet
    const { clear } = you

    const erase = useCallback(async () => {
        reset()
        await clear()
        clearPersistedState(TEMPLATES_PREFS_KEY)
    }, [clear, reset])

    const value = useMemo<TemplatesApi>(
        () => ({ ...templateSet, you, erase }),
        [templateSet, you, erase],
    )

    return <TemplatesContext.Provider value={value}>{children}</TemplatesContext.Provider>
}

export function useTemplates(): TemplatesApi {
    const api = useContext(TemplatesContext)

    if (api === null) {
        throw new Error('useTemplates must be used inside a TemplatesProvider')
    }

    return api
}
