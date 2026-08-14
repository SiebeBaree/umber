import { httpFetch } from '../../lib/http'
import type { AspectRatio } from '../create/catalog'
import { GenerationError, offlineError } from './errors'
import type { EngineRequest } from './request'
import { encodeDataUri, fetchBinary, nearestSize, poll, readJson } from './shared'

/**
 * Alibaba Model Studio (DashScope): Qwen-Image synchronously, Wan video as
 * an async task. Keys are region-locked, so the base URL follows the region
 * chosen when the key was connected.
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
 * Wan text-to-video takes an exact `width*height`, which carries both the
 * shape and the tier. Image-to-video takes a `resolution` instead and follows
 * the shape of the picture it is given, so it reads none of this.
 */
const WAN_SIZES: Readonly<Record<string, Readonly<Partial<Record<AspectRatio, string>>>>> = {
    '720p': {
        '16:9': '1280*720',
        '9:16': '720*1280',
        '1:1': '960*960',
        '4:3': '1088*832',
        '3:4': '832*1088',
    },
    '1080p': {
        '16:9': '1920*1080',
        '9:16': '1080*1920',
        '1:1': '1440*1440',
        '4:3': '1632*1248',
        '3:4': '1248*1632',
    },
}

function wanSize(ratio: AspectRatio, resolution: string): string {
    const tier = WAN_SIZES[resolution] ?? WAN_SIZES['1080p'] ?? {}

    return tier[ratio] ?? '1920*1080'
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

export function generateAlibabaImages(request: EngineRequest): Promise<Blob[]> {
    return Promise.all(Array.from({ length: request.count }, () => generateOneImage(request)))
}

interface WanTask {
    readonly output?: {
        readonly task_id?: string
        readonly task_status?: string
        readonly video_url?: string
        readonly message?: string
    }
}

/** Starts the async Wan task and returns its id. */
async function createWanTask(request: EngineRequest): Promise<string> {
    const reference = request.references[0]

    let created: Response

    try {
        created = await httpFetch(
            `${apiRoot(request)}/services/aigc/video-generation/video-synthesis`,
            {
                headers: { ...headersOf(request), 'X-DashScope-Async': 'enable' },
                json: {
                    model: reference === undefined ? 'wan2.6-t2v' : 'wan2.6-i2v',
                    input: {
                        prompt: request.prompt,
                        ...(reference === undefined
                            ? {}
                            : { img_url: await encodeDataUri(reference) }),
                    },
                    parameters: {
                        ...(reference === undefined
                            ? { size: wanSize(request.ratio, request.resolution) }
                            : { resolution: request.resolution.toUpperCase() }),
                        duration: request.durationSeconds,
                        watermark: false,
                    },
                },
            },
        )
    } catch {
        throw offlineError('Alibaba')
    }

    if (!created.ok) {
        throw await toGenerationError(created)
    }

    const task = (await readJson(created)) as WanTask | null
    const taskId = task?.output?.task_id

    if (typeof taskId !== 'string' || taskId === '') {
        throw new GenerationError('Alibaba accepted the run but returned no task to follow.')
    }

    return taskId
}

export async function generateAlibabaVideo(request: EngineRequest): Promise<Blob[]> {
    const taskId = await createWanTask(request)

    const finished = await poll({
        intervalMs: 10_000,
        timeoutMs: 15 * 60_000,
        timeoutMessage: 'Alibaba is still rendering after 15 minutes. Try again.',
        check: async () => {
            const response = await httpFetch(`${apiRoot(request)}/tasks/${taskId}`, {
                headers: headersOf(request),
            })

            if (!response.ok) {
                throw await toGenerationError(response)
            }

            const state = (await readJson(response)) as WanTask | null
            const status = state?.output?.task_status

            if (status === 'SUCCEEDED') {
                return state
            }

            if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
                throw new GenerationError(
                    state?.output?.message ?? 'Alibaba could not finish this video.',
                )
            }

            return null
        },
    })

    const url = finished?.output?.video_url

    if (typeof url !== 'string' || url === '') {
        throw new GenerationError('Alibaba finished the run but returned no video.')
    }

    return [await fetchBinary('Alibaba', url, 'video/mp4')]
}
