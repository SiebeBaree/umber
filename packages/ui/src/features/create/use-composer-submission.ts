import { useCallback, useEffect, useState } from 'react'

import { useGeneration } from '../generate/generation-context'
import { useKeys } from '../keys/keys-context'
import { MODELS_BY_MODE, PROVIDERS, type GenerationMode, type Model } from './catalog'
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
    readonly submit: (prompt: string, references: readonly File[]) => void
}

/**
 * How many runs may be in flight together. Runs are independent, so this is
 * not a technical limit — it is a backstop against a stuck Enter key, set high
 * enough that asking for ten at once is a thing you can simply do.
 */
const MAX_RUNS_IN_FLIGHT = 10

function blockerFor(ready: boolean, connected: boolean, model: Model, running: number) {
    // Nothing is declared blocked before the vault has answered.
    if (!ready) {
        return null
    }

    if (!connected) {
        return `Connect your ${PROVIDERS[model.provider].name} key in Settings to use ${model.name}`
    }

    if (running >= MAX_RUNS_IN_FLIGHT) {
        return `${MAX_RUNS_IN_FLIGHT} runs are already going. Wait for one to finish.`
    }

    return null
}

export function useComposerSubmission(): ComposerSubmission {
    const [mode, setMode] = useState<GenerationMode>('image')

    const composer = useComposerSettings(mode)
    const keys = useKeys()
    const generation = useGeneration()

    const { model } = composer
    const providerConnected = keys.connectedProviders.has(model.provider)
    const blocker = blockerFor(keys.ready, providerConnected, model, generation.running)

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
            if (prompt === '' || blocker !== null) {
                return
            }

            generation.start({ prompt, model, settings: composer.settings, references })
        },
        [blocker, composer.settings, generation, model],
    )

    return { mode, setMode, composer, blocker, submit }
}
