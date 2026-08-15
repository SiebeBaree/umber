import { httpFetch } from '../../lib/http'
import type { AspectRatio } from '../create/catalog'
import { GenerationError, offlineError } from './errors'
import type { EngineRequest } from './request'
import { encodeDataUri, fetchBinary, nearestSize, readJson } from './shared'

/**
 * Alibaba Model Studio (DashScope), image side: the Qwen-Image family over
 * the synchronous multimodal-generation endpoint. Keys are region-locked, so
 * the base URL follows the region chosen when the key was connected. Wan
 * video shares the key and error language from `./wan`.
 */

function apiRoot(request: EngineRequest): string {
    return request.credentials['region'] === 'china'
        ? 'https://dashscope.aliyuncs.com/api/v1'
        : 'https://dashscope-intl.aliyuncs.com/api/v1'
}

/** The output shapes Qwen-Image-Plus renders, in DashScope's `*` notation. */
const QWEN_SIZES: readonly string[] = [
    '1664*928',
    '1472*1104',
    '1328*1328',
    '1104*1472',
    '928*1664',
]

/**
 * Qwen-Image-3.0-Pro takes a free-form `width*height` between 512 and 2048 on
 * each edge instead of a closed list, so each composer ratio gets an explicit
 * size per tier: the documented Qwen shapes at 1K, the 2048-edge maxima at 2K.
 */
const QWEN_3_SIZES: Readonly<Record<string, Readonly<Partial<Record<AspectRatio, string>>>>> = {
    '1K': {
        '1:1': '1328*1328',
        '3:2': '1584*1056',
        '2:3': '1056*1584',
        '4:3': '1472*1104',
        '3:4': '1104*1472',
        '16:9': '1664*928',
        '9:16': '928*1664',
        '21:9': '1792*768',
    },
    '2K': {
        '1:1': '2048*2048',
        '3:2': '2048*1360',
        '2:3': '1360*2048',
        '4:3': '2048*1536',
        '3:4': '1536*2048',
        '16:9': '2048*1152',
        '9:16': '1152*2048',
        '21:9': '2048*880',
    },
}

function qwen3Size(ratio: AspectRatio, resolution: string): string {
    const tier = QWEN_3_SIZES[resolution] ?? QWEN_3_SIZES['1K'] ?? {}

    return tier[ratio] ?? '1328*1328'
}

interface DashScopeError {
    readonly code?: string
    readonly message?: string
}

function headersOf(request: EngineRequest): Readonly<Record<string, string>> {
    return { Authorization: `Bearer ${request.credentials['apiKey'] ?? ''}` }
}

async function toGenerationError(response: Response): Promise<GenerationError> {
    const body = (await readJson(response)) as DashScopeError | null

    if (response.status === 401 || body?.code === 'InvalidApiKey') {
        return new GenerationError(
            'Alibaba rejected the API key. Check the key and its region in Settings.',
        )
    }

    if (response.status === 429) {
        return new GenerationError(
            'Alibaba is rate limiting this key. Give it a moment and try again.',
        )
    }

    if (body?.code === 'DataInspectionFailed') {
        return new GenerationError('Alibaba declined this prompt as against its usage policies.')
    }

    return new GenerationError(
        typeof body?.message === 'string' && body.message !== ''
            ? body.message
            : `Alibaba returned an unexpected error (${response.status}).`,
    )
}

interface QwenImageResponse {
    readonly output?: {
        readonly choices?: readonly {
            readonly message?: {
                readonly content?: readonly { readonly image?: string }[]
            }
        }[]
    }
}

/** One image per call, so a multi-image run is parallel calls. */
async function generateOneImage(request: EngineRequest): Promise<Blob> {
    if (request.references.length > 0) {
        throw new GenerationError(
            'Qwen Image does not take reference images here. Remove them or switch models.',
        )
    }

    let response: Response

    try {
        response = await httpFetch(
            `${apiRoot(request)}/services/aigc/multimodal-generation/generation`,
            {
                headers: headersOf(request),
                json: {
                    model: 'qwen-image-plus',
                    input: {
                        messages: [{ role: 'user', content: [{ text: request.prompt }] }],
                    },
                    parameters: {
                        size: nearestSize(request.ratio, QWEN_SIZES, '*'),
                        n: 1,
                        watermark: false,
                        prompt_extend: true,
                    },
                },
            },
        )
    } catch {
        throw offlineError('Alibaba')
    }

    if (!response.ok) {
        throw await toGenerationError(response)
    }

    const body = (await readJson(response)) as QwenImageResponse | null
    const url = body?.output?.choices?.[0]?.message?.content?.find(
        (part) => typeof part.image === 'string' && part.image !== '',
    )?.image

    if (url === undefined) {
        throw new GenerationError('Alibaba returned no image for this prompt.')
    }

    return fetchBinary('Alibaba', url, 'image/png')
}

/** The Qwen-Image-3.0-Pro request: references in the message, size and count
 * in the parameters. */
async function qwen3Body(request: EngineRequest): Promise<Record<string, unknown>> {
    const references = await Promise.all(
        request.references.slice(0, 3).map((file) => encodeDataUri(file)),
    )

    return {
        model: 'qwen-image-3.0-pro',
        input: {
            messages: [
                {
                    role: 'user',
                    content: [...references.map((image) => ({ image })), { text: request.prompt }],
                },
            ],
        },
        parameters: {
            size: qwen3Size(request.ratio, request.resolution),
            n: request.count,
            watermark: false,
            prompt_extend: true,
        },
    }
}

/**
 * Qwen-Image-3.0-Pro: still the multimodal-generation endpoint, but with the
 * reference images in the message, a free-form size, and a native `n` — one
 * request for the whole run, which also respects the model's tight rate limit.
 */
async function generateQwen3Images(request: EngineRequest): Promise<Blob[]> {
    let response: Response

    try {
        response = await httpFetch(
            `${apiRoot(request)}/services/aigc/multimodal-generation/generation`,
            { headers: headersOf(request), json: await qwen3Body(request) },
        )
    } catch {
        throw offlineError('Alibaba')
    }

    if (!response.ok) {
        throw await toGenerationError(response)
    }

    const body = (await readJson(response)) as QwenImageResponse | null
    const urls = (body?.output?.choices ?? [])
        .flatMap((choice) => choice.message?.content ?? [])
        .map((part) => part.image)
        .filter((url): url is string => typeof url === 'string' && url !== '')

    if (urls.length === 0) {
        throw new GenerationError('Alibaba returned no image for this prompt.')
    }

    return Promise.all(urls.map((url) => fetchBinary('Alibaba', url, 'image/png')))
}

export function generateAlibabaImages(request: EngineRequest): Promise<Blob[]> {
    if (request.modelId === 'qwen-image-3-pro') {
        return generateQwen3Images(request)
    }

    return Promise.all(Array.from({ length: request.count }, () => generateOneImage(request)))
}

/** Shared with the Wan module, which speaks the same API with the same key. */
export {
    apiRoot as alibabaApiRoot,
    headersOf as alibabaHeadersOf,
    toGenerationError as toAlibabaError,
}
