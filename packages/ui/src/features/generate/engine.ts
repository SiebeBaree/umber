import type { AspectRatio } from '../create/catalog'
import { generateOpenAiImages, GenerationError } from './openai'

/**
 * Fans a generation request out to the provider that owns the model. One
 * switch, so adding a provider integration is one more case — and a model
 * whose provider has no case yet fails with a sentence, not a stack trace.
 */

export interface EngineRequest {
    readonly providerId: string
    readonly credentials: Readonly<Record<string, string>>
    readonly modelId: string
    readonly prompt: string
    readonly count: number
    readonly ratio: AspectRatio
    readonly resolution: string
    readonly quality: string
    readonly references: readonly File[]
}

export function runGeneration(request: EngineRequest): Promise<Blob[]> {
    if (request.providerId === 'openai') {
        return generateOpenAiImages({
            apiKey: request.credentials['apiKey'] ?? '',
            modelId: request.modelId,
            prompt: request.prompt,
            count: request.count,
            ratio: request.ratio,
            resolution: request.resolution,
            quality: request.quality,
            references: request.references,
        })
    }

    return Promise.reject(
        new GenerationError('Only OpenAI generation is wired up so far. More providers follow.'),
    )
}
