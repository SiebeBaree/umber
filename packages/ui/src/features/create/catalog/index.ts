import { IMAGE_MODELS } from './image-models'
import type { ImageModel, Model, Provider, ProviderId, VideoModel } from './types'
import { VIDEO_MODELS } from './video-models'

export * from './types'
export * from './output-size'
export { IMAGE_MODELS } from './image-models'
export { VIDEO_MODELS } from './video-models'
export { ProviderMark, type ProviderMarkProps } from './provider-mark'

export const PROVIDERS: Readonly<Record<ProviderId, Provider>> = {
    google: { id: 'google', name: 'Google' },
    openai: { id: 'openai', name: 'OpenAI' },
    blackForestLabs: { id: 'blackForestLabs', name: 'Black Forest Labs' },
    bytedance: { id: 'bytedance', name: 'ByteDance' },
    // Kuaishou owns Kling, but nobody buys a key from Kuaishou — the console,
    // the docs and the models all say Kling, so that is the name shown. The id
    // stays as it is: it keys the vault, and renaming it would strand any key
    // already stored under it.
    kuaishou: { id: 'kuaishou', name: 'Kling' },
    alibaba: { id: 'alibaba', name: 'Alibaba' },
    runway: { id: 'runway', name: 'Runway' },
    ideogram: { id: 'ideogram', name: 'Ideogram' },
    recraft: { id: 'recraft', name: 'Recraft' },
    minimax: { id: 'minimax', name: 'MiniMax' },
    xai: { id: 'xai', name: 'xAI' },
    reve: { id: 'reve', name: 'Reve' },
}

export const MODELS_BY_MODE = {
    image: IMAGE_MODELS,
    video: VIDEO_MODELS,
} as const satisfies Readonly<Record<string, readonly Model[]>>

export type GenerationMode = keyof typeof MODELS_BY_MODE

export const GENERATION_MODES = ['image', 'video'] as const satisfies readonly GenerationMode[]

/** Narrowing helpers, so callers never cast between the two model shapes. */
export function isImageModel(model: Model): model is ImageModel {
    return model.kind === 'image'
}

export function isVideoModel(model: Model): model is VideoModel {
    return model.kind === 'video'
}

export function findModel(mode: GenerationMode, id: string): Model | undefined {
    return MODELS_BY_MODE[mode].find((model) => model.id === id)
}

/**
 * The model a mode falls back to: the newest one on offer.
 *
 * The catalogs are non-empty by construction, which the tuple destructuring
 * below asserts — a mode with no models is a programming error, not a state the
 * UI should try to render around.
 */
export function defaultModel(mode: GenerationMode): Model {
    const [first, ...rest] = MODELS_BY_MODE[mode]

    if (first === undefined) {
        throw new Error(`Umber has no ${mode} models configured`)
    }

    return rest.reduce(
        (newest, model) => (model.releasedOn > newest.releasedOn ? model : newest),
        first,
    )
}

export interface ModelGroup {
    readonly provider: Provider
    readonly models: readonly Model[]
}

/**
 * The catalog as the picker shows it: one group per vendor, ordered by how
 * recently each shipped anything, with that vendor's own models newest-first —
 * so whatever is current is always nearest the top.
 *
 * Pinning does not remove a model from here. A pinned model is *copied* to the
 * top of the list, not moved, so the vendor's line-up always reads complete and
 * a model never seems to vanish because you starred it.
 */
export function groupModels(mode: GenerationMode): readonly ModelGroup[] {
    const byProvider = new Map<ProviderId, Model[]>()

    for (const model of MODELS_BY_MODE[mode]) {
        const existing = byProvider.get(model.provider)
        if (existing === undefined) {
            byProvider.set(model.provider, [model])
        } else {
            existing.push(model)
        }
    }

    const groups = [...byProvider.entries()]
        .map(([provider, models]) => ({
            provider: PROVIDERS[provider],
            models: models.toSorted((a, b) => b.releasedOn.localeCompare(a.releasedOn)),
        }))
        .toSorted((a, b) => newestRelease(b.models).localeCompare(newestRelease(a.models)))

    return groups
}

function newestRelease(models: readonly Model[]): string {
    return models.reduce(
        (newest, model) => (model.releasedOn > newest ? model.releasedOn : newest),
        '',
    )
}

/** The starred models, newest first, for the pinned group above the vendors. */
export function starredModels(
    mode: GenerationMode,
    starred: ReadonlySet<string>,
): readonly Model[] {
    return MODELS_BY_MODE[mode]
        .filter((model) => starred.has(model.id))
        .toSorted((a, b) => b.releasedOn.localeCompare(a.releasedOn))
}
