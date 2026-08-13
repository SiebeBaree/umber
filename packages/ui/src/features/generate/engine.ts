import { generateAlibabaImages, generateAlibabaVideo } from './alibaba'
import { generateBflImages } from './bfl'
import { generateBytedanceImages, generateBytedanceVideo } from './bytedance'
import { GenerationError } from './errors'
import { generateGoogleImages } from './google'
import { generateIdeogramImages } from './ideogram'
import { generateKlingImages, generateKlingVideo } from './kling'
import { generateLtxVideo } from './lightricks'
import { generateLumaImages, generateLumaVideo } from './luma'
import { generateMinimaxImages, generateMinimaxVideo } from './minimax'
import { generateOpenAiImages } from './openai'
import { generatePixverseVideo } from './pixverse'
import { generateRecraftImages } from './recraft'
import type { EngineRequest } from './request'
import { generateRunwayImages, generateRunwayVideo } from './runway'
import { generateOpenAiVideo } from './sora'
import { generateStabilityImages } from './stability'
import { generateGoogleVideo } from './veo'

export type { EngineRequest } from './request'

/**
 * Fans a generation request out to the provider that owns the model: one
 * table per mode, one entry per integration — and a model whose provider has
 * no entry yet fails with a sentence, not a stack trace. Image runs resolve
 * to one blob per image; video runs to a single clip.
 */

type Generator = (request: EngineRequest) => Promise<Blob[]>

const IMAGE_GENERATORS: Readonly<Record<string, Generator>> = {
    openai: generateOpenAiImages,
    google: generateGoogleImages,
    blackForestLabs: generateBflImages,
    stability: generateStabilityImages,
    ideogram: generateIdeogramImages,
    recraft: generateRecraftImages,
    runway: generateRunwayImages,
    luma: generateLumaImages,
    kuaishou: generateKlingImages,
    minimax: generateMinimaxImages,
    bytedance: generateBytedanceImages,
    alibaba: generateAlibabaImages,
}

const VIDEO_GENERATORS: Readonly<Record<string, Generator>> = {
    openai: generateOpenAiVideo,
    google: generateGoogleVideo,
    runway: generateRunwayVideo,
    luma: generateLumaVideo,
    kuaishou: generateKlingVideo,
    minimax: generateMinimaxVideo,
    bytedance: generateBytedanceVideo,
    alibaba: generateAlibabaVideo,
    pixverse: generatePixverseVideo,
    lightricks: generateLtxVideo,
}

export function runGeneration(request: EngineRequest): Promise<Blob[]> {
    const table = request.mode === 'video' ? VIDEO_GENERATORS : IMAGE_GENERATORS
    const generate = table[request.providerId]

    if (generate === undefined) {
        return Promise.reject(
            new GenerationError(`No ${request.mode} integration exists for this provider yet.`),
        )
    }

    return generate(request)
}
