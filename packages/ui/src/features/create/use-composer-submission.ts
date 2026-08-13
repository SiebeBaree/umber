import { useCallback, useEffect, useState } from 'react'

import { useGeneration } from '../generate/generation-context'
import { useKeys } from '../keys/keys-context'
import { isImageModel, MODELS_BY_MODE, PROVIDERS, type GenerationMode, type Model } from './catalog'
import { useComposerSettings, type ComposerSettingsApi } from './settings/use-composer-settings'

/**
 * Everything behind the composer's send button: which mode is active, whether
 * a run may start, why it may not, and the handoff to the generation store.
 * Kept out of the component so the composer is layout and this is policy.
 */
export interface ComposerSubmission {
    readonly mode: GenerationMode
    readonly setMode: (mode: GenerationMode) => void
    readonly composer: ComposerSettingsApi
    /** Why pressing send would do nothing, or null when it would generate. */
    readonly blocker: string | null
    /** True while a run is in flight; one run at a time. */
    readonly busy: boolean
    readonly submit: (prompt: string, references: readonly File[]) => void
}

function blockerFor(ready: boolean, mode: GenerationMode, connected: boolean, model: Model) {
    // Nothing is declared blocked before the vault has answered.
    if (!ready) {
        return null
    }

    // Video first: telling someone to connect a key for a mode that would not
    // run anyway sends them on an errand for nothing.
    if (mode === 'video') {
        return 'Video generation is not wired up yet'
    }

    if (!connected) {
        return `Connect your ${PROVIDERS[model.provider].name} key in Settings to use ${model.name}`
    }

    return null
}

export function useComposerSubmission(): ComposerSubmission {
    const [mode, setMode] = useState<GenerationMode>('image')

    const composer = useComposerSettings(mode)
    const keys = useKeys()
    const generation = useGeneration()

    const { model } = composer
    const busy = generation.activeJob?.status === 'running'
    const providerConnected = keys.connectedProviders.has(model.provider)
    const blocker = blockerFor(keys.ready, mode, providerConnected, model)

    // If the remembered model is locked but some other model in this mode is
    // usable, quietly move to the newest usable one — a fresh install with one
    // key should land on a model that works, not on a disabled default.
    useEffect(() => {
        if (!keys.ready || providerConnected) {
            return
        }

        const usable = MODELS_BY_MODE[mode]
            .filter((candidate) => keys.connectedProviders.has(candidate.provider))
            .toSorted((a, b) => b.releasedOn.localeCompare(a.releasedOn))[0]

        if (usable !== undefined) {
            composer.selectModel(usable.id)
        }
    }, [keys.ready, keys.connectedProviders, providerConnected, mode, composer])

    const submit = useCallback(
        (prompt: string, references: readonly File[]) => {
            if (prompt === '' || blocker !== null || busy || !isImageModel(model)) {
                return
            }

            generation.start({ prompt, model, settings: composer.settings, references })
        },
        [blocker, busy, composer.settings, generation, model],
    )

    return { mode, setMode, composer, blocker, busy: busy === true, submit }
}
