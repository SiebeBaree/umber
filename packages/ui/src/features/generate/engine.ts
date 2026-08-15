import { generateAlibabaImages } from './alibaba'
import { generateBflImages, generateBflVideo } from './bfl'
import { generateBytedanceImages, generateBytedanceVideo } from './bytedance'
import { GenerationError } from './errors'
import { generateGoogleImages } from './google'
import { generateIdeogramImages } from './ideogram'
import { generateKlingImages } from './kling'
import { generateKlingVideo } from './kling-three'
import { generateMinimaxVideo } from './minimax'
import { generateOpenAiImages } from './openai'
import { generateRecraftImages } from './recraft'
import type { EngineRequest } from './request'
import { generateReveImages } from './reve'
import { generateRunwayImages, generateRunwayVideo } from './runway'
import { generateOpenAiVideo } from './sora'
import { generateGoogleVideo } from './veo'
import { generateAlibabaVideo } from './wan'
import { generateXaiImages, generateXaiVideo } from './xai'

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
    ideogram: generateIdeogramImages,
    recraft: generateRecraftImages,
    runway: generateRunwayImages,
    kuaishou: generateKlingImages,
    bytedance: generateBytedanceImages,
    alibaba: generateAlibabaImages,
    xai: generateXaiImages,
    reve: generateReveImages,
}

const VIDEO_GENERATORS: Readonly<Record<string, Generator>> = {
    openai: generateOpenAiVideo,
    google: generateGoogleVideo,
    runway: generateRunwayVideo,
    kuaishou: generateKlingVideo,
    bytedance: generateBytedanceVideo,
    alibaba: generateAlibabaVideo,
    blackForestLabs: generateBflVideo,
    minimax: generateMinimaxVideo,
    xai: generateXaiVideo,
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
