import { useCallback, useRef } from 'react'
import { z } from 'zod'

import { usePersistedState } from '../../lib/persisted-state'
import { MAX_SET_SIZE, PLATFORMS, RECIPES } from './platforms'

/** What Templates remembers between launches. */
const prefsSchema = z.object({
    platform: z.enum(PLATFORMS),
    count: z.number().int().min(1).max(MAX_SET_SIZE),
    /** Scene ids from recent renders, oldest first, so the next set avoids them. */
    recent: z.array(z.string()),
})

export type TemplatePrefs = z.output<typeof prefsSchema>

export const TEMPLATES_PREFS_KEY = 'umber.templates.v1'

// LinkedIn first: the smallest set, so the cheapest first try.
export const DEFAULT_PREFS: TemplatePrefs = {
    platform: 'linkedin',
    count: RECIPES.linkedin.defaultCount,
    recent: [],
}

/** Enough to keep a few sets of every platform fresh. */
const RECENT_KEPT = 40

export function withRecent(prefs: TemplatePrefs, sceneId: string): TemplatePrefs {
    return {
        ...prefs,
        recent: [...prefs.recent.filter((id) => id !== sceneId), sceneId].slice(-RECENT_KEPT),
    }
}

/** The remembered choices, readable from async callbacks without going stale. */
export function useTemplatePrefs() {
    const [prefs, storePrefs] = usePersistedState(TEMPLATES_PREFS_KEY, prefsSchema, DEFAULT_PREFS)
    const prefsRef = useRef(prefs)

    const updatePrefs = useCallback(
        (change: (current: TemplatePrefs) => TemplatePrefs) => {
            prefsRef.current = change(prefsRef.current)
            storePrefs(prefsRef.current)
        },
        [storePrefs],
    )

    return { prefs, prefsRef, updatePrefs }
}
