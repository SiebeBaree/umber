import type { AspectRatio, GenerationMode } from '../create/catalog'

/**
 * Everything a provider integration is handed for one run. One shape for both
 * modes: image runs carry a zero duration, video runs a count of one, and each
 * integration reads only the fields its API speaks.
 */
export interface EngineRequest {
    readonly mode: GenerationMode
    readonly providerId: string
    /** Field id → value, exactly as the provider's credential form declares. */
    readonly credentials: Readonly<Record<string, string>>
    /** Catalog id; integrations translate to their wire names. */
    readonly modelId: string
    readonly prompt: string
    readonly count: number
    readonly ratio: AspectRatio
    readonly resolution: string
    readonly quality: string
    readonly durationSeconds: number
    /** Reference images grounding the run, where the model accepts them. */
    readonly references: readonly File[]
}
