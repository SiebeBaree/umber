import { httpFetch } from '../../lib/http'
import type { AspectRatio } from '../create/catalog'
import { alibabaApiRoot, alibabaHeadersOf, toAlibabaError } from './alibaba'
import { GenerationError, offlineError } from './errors'
import type { EngineRequest } from './request'
import { encodeDataUri, fetchBinary, poll, readJson } from './shared'

/**
 * Wan, split from the Qwen image module because it is a different lifecycle:
 * an async task is created, polled, and its finished clip downloaded from a
 * short-lived URL. Wan 2.6 and 2.7 also disagree about the request body, so
 * each generation builds its own.
 */

/**
 * Wan 2.6 text-to-video takes an exact `width*height`, which carries both the
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

interface WanTask {
    readonly output?: {
        readonly task_id?: string
        readonly task_status?: string
        readonly video_url?: string
        readonly message?: string
    }
}

/**
 * The Wan 2.7 request body. 2.7 retired 2.6's `size` and `img_url` fields: a
 * text run names a `resolution` and `ratio`, and a grounded run hands its
 * stills over in a typed `media` list, the closing frame included — which is
 * why it does not share 2.6's body builder below.
 */
async function wanTwoSevenBody(request: EngineRequest): Promise<Record<string, unknown>> {
    const { firstFrame, lastFrame } = request

    // The API's own rule: last-frame-only generation is not supported.
    if (lastFrame !== undefined && firstFrame === undefined) {
        throw new GenerationError(
            'Wan renders towards an end frame only from a start frame. Add one, or remove the end frame.',
        )
    }

    const media = [
        ...(firstFrame === undefined
            ? []
            : [{ type: 'first_frame', url: await encodeDataUri(firstFrame) }]),
        ...(lastFrame === undefined
            ? []
            : [{ type: 'last_frame', url: await encodeDataUri(lastFrame) }]),
    ]

    return {
        model: media.length === 0 ? 'wan2.7-t2v' : 'wan2.7-i2v',
        input: {
            prompt: request.prompt,
            ...(media.length === 0 ? {} : { media }),
        },
        parameters: {
            resolution: request.resolution.toUpperCase(),
            // Image-to-video follows the shape of the supplied frame.
            ...(media.length === 0 ? { ratio: request.ratio } : {}),
            duration: request.durationSeconds,
            watermark: false,
        },
    }
}

/** The Wan 2.6 request body, exactly as it has always been sent. */
async function wanTwoSixBody(request: EngineRequest): Promise<Record<string, unknown>> {
    const reference = request.firstFrame

    return {
        model: reference === undefined ? 'wan2.6-t2v' : 'wan2.6-i2v',
        input: {
            prompt: request.prompt,
            ...(reference === undefined ? {} : { img_url: await encodeDataUri(reference) }),
        },
        parameters: {
            ...(reference === undefined
                ? { size: wanSize(request.ratio, request.resolution) }
                : { resolution: request.resolution.toUpperCase() }),
            duration: request.durationSeconds,
            watermark: false,
        },
    }
}

/** Starts the async Wan task and returns its id. */
async function createWanTask(request: EngineRequest): Promise<string> {
    let created: Response

    try {
        created = await httpFetch(
            `${alibabaApiRoot(request)}/services/aigc/video-generation/video-synthesis`,
            {
                headers: { ...alibabaHeadersOf(request), 'X-DashScope-Async': 'enable' },
                json:
                    request.modelId === 'wan-2-7'
                        ? await wanTwoSevenBody(request)
                        : await wanTwoSixBody(request),
            },
        )
    } catch {
        throw offlineError('Alibaba')
    }

    if (!created.ok) {
        throw await toAlibabaError(created)
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
            const response = await httpFetch(`${alibabaApiRoot(request)}/tasks/${taskId}`, {
                headers: alibabaHeadersOf(request),
            })

            if (!response.ok) {
                throw await toAlibabaError(response)
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
