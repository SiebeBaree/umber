import { useCallback, useMemo } from 'react'

import { usePersistedState } from '../../../lib/persisted-state'
import type { GenerationMode, Model } from '../catalog'
import { defaultModeSettings, reconcileToModel, resolveModel } from './reconcile'
import { composerSettingsSchema, COMPOSER_SETTINGS_KEY, type ModeSettings } from './schema'

export interface ComposerSettingsApi {
    /** Already reconciled against `model`, so it is always safe to send. */
    readonly settings: ModeSettings
    readonly model: Model
    readonly starred: ReadonlySet<string>
    readonly selectModel: (modelId: string) => void
    readonly update: (patch: Partial<ModeSettings>) => void
    readonly toggleStar: (modelId: string) => void
}

/**
 * The composer's remembered choices for one mode.
 *
 * Everything is persisted, and everything is reconciled against the selected
 * model on the way out — so a value that a newly chosen model cannot honour is
 * corrected before any component sees it, not after a request fails.
 */
export function useComposerSettings(mode: GenerationMode): ComposerSettingsApi {
    const [stored, store] = usePersistedState(COMPOSER_SETTINGS_KEY, composerSettingsSchema, {
        image: defaultModeSettings('image'),
        video: defaultModeSettings('video'),
        starredModelIds: [],
    })

    const model = resolveModel(mode, stored[mode].modelId)
    const settings = useMemo(() => reconcileToModel(stored[mode], model), [stored, mode, model])
    const starred = useMemo(() => new Set(stored.starredModelIds), [stored.starredModelIds])

    const commit = useCallback(
        (next: ModeSettings) => {
            store({ ...stored, [mode]: next })
        },
        [mode, store, stored],
    )

    const selectModel = useCallback(
        (modelId: string) => {
            commit(reconcileToModel(settings, resolveModel(mode, modelId)))
        },
        [commit, mode, settings],
    )

    const update = useCallback(
        (patch: Partial<ModeSettings>) => {
            commit(reconcileToModel({ ...settings, ...patch }, model))
        },
        [commit, model, settings],
    )

    const toggleStar = useCallback(
        (modelId: string) => {
            const next = stored.starredModelIds.includes(modelId)
                ? stored.starredModelIds.filter((id) => id !== modelId)
                : [...stored.starredModelIds, modelId]

            store({ ...stored, starredModelIds: next })
        },
        [store, stored],
    )

    return { settings, model, starred, selectModel, update, toggleStar }
}
