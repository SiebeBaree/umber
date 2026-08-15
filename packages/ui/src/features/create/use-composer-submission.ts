import { useCallback, useEffect, useState } from 'react'

import { useShortcut, type Shortcut } from '../../lib/use-shortcut'
import { useGeneration, type StartInput } from '../generate/generation-context'
import { useKeys } from '../keys/keys-context'
import { MODELS_BY_MODE, PROVIDERS, type GenerationMode, type Model } from './catalog'
import type { ModeSettings } from './settings/schema'
import { useComposerSettings, type ComposerSettingsApi } from './settings/use-composer-settings'
import type { ComposerAsset } from './use-composer-assets'

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
    readonly submit: (prompt: string, assets: readonly ComposerAsset[]) => void
}

/**
 * How many runs may be in flight together. Runs are independent, so this is
 * not a technical limit — it is a backstop against a stuck Enter key, set high
 * enough that asking for ten at once is a thing you can simply do.
 */
const MAX_RUNS_IN_FLIGHT = 10

/** Toggles the mode. Fires mid-prompt, which is where the wish usually lands. */
const SWITCH_MODE: Shortcut = { key: 'm', meta: true, shift: true, whileTyping: true }

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

/**
 * The slots dissolve here into what the engine speaks: frames by name,
 * everything else as the reference list.
 */
function toStartInput(
    prompt: string,
    model: Model,
    settings: ModeSettings,
    assets: readonly ComposerAsset[],
): StartInput {
    const firstFrame = assets.find((asset) => asset.slot === 'start')?.file
    const lastFrame = assets.find((asset) => asset.slot === 'end')?.file

    return {
        prompt,
        model,
        settings,
        references: assets.filter((asset) => asset.slot === 'reference').map((asset) => asset.file),
        ...(firstFrame === undefined ? {} : { firstFrame }),
        ...(lastFrame === undefined ? {} : { lastFrame }),
    }
}

export function useComposerSubmission(): ComposerSubmission {
    const [mode, setMode] = useState<GenerationMode>('image')

    // Cmd+Shift+M flips image and video, exactly like the toolbar control.
    useShortcut(SWITCH_MODE, () => {
        setMode((current) => (current === 'image' ? 'video' : 'image'))
    })

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
        (prompt: string, assets: readonly ComposerAsset[]) => {
            if (prompt !== '' && blocker === null) {
                generation.start(toStartInput(prompt, model, composer.settings, assets))
            }
        },
        [blocker, composer.settings, generation, model],
    )

    return { mode, setMode, composer, blocker, submit }
}
