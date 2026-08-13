import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import type { EngineRequest } from './request'
import { decodeBase64Blob, encodeDataUri, fetchBinary, poll, readJson } from './shared'

/**
 * The MiniMax API: synchronous image generation, and Hailuo video as a task
 * plus a file-retrieval hop — the finished clip hides behind a `file_id`
 * whose download URL lives for an hour.
 */

const API_ROOT = 'https://api.minimax.io/v1'

const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'hailuo-2-3': 'MiniMax-Hailuo-2.3',
    'hailuo-2-3-fast': 'MiniMax-Hailuo-2.3-Fast',
    'minimax-image-01': 'image-01',
}

/** Hailuo's wire tiers; the catalog's 720p is its 768P class. */
const RESOLUTIONS: Readonly<Record<string, string>> = {
    '720p': '768P',
    '1080p': '1080P',
}

interface BaseResp {
    readonly status_code?: number
    readonly status_msg?: string
}

function headersOf(request: EngineRequest): Readonly<Record<string, string>> {
    return { Authorization: `Bearer ${request.credentials['apiKey'] ?? ''}` }
}

/** MiniMax reports failures inside a 200, so the envelope speaks first. */
function envelopeError(base: BaseResp | undefined): GenerationError | null {
    const code = base?.status_code

    if (code === undefined || code === 0) {
        return null
    }

    if (code === 1004 || code === 2049) {
        return new GenerationError('MiniMax rejected the API key. Check it in Settings.')
    }

    if (code === 1008) {
        return new GenerationError(
            'Your MiniMax account is out of credit. Top up in the MiniMax console.',
        )
    }

    if (code === 1026) {
        return new GenerationError('MiniMax declined this prompt as against its usage policies.')
    }

    if (code === 1002) {
        return new GenerationError(
            'MiniMax is rate limiting this key. Give it a moment and try again.',
        )
    }

    return new GenerationError(
        base?.status_msg === undefined || base.status_msg === ''
            ? `MiniMax returned an unexpected error (${code}).`
            : `MiniMax: ${base.status_msg}`,
    )
}

interface ImageResponse {
    readonly data?: { readonly image_base64?: readonly string[] }
    readonly base_resp?: BaseResp
}

export async function generateMinimaxImages(request: EngineRequest): Promise<Blob[]> {
    const reference = request.references[0]

    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/image_generation`, {
            headers: headersOf(request),
            json: {
                model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
                prompt: request.prompt,
                aspect_ratio: request.ratio,
                n: request.count,
                response_format: 'base64',
                prompt_optimizer: true,
                ...(reference === undefined
                    ? {}
                    : {
                          subject_reference: [
                              { type: 'character', image_file: await encodeDataUri(reference) },
                          ],
                      }),
            },
        })
    } catch {
        throw offlineError('MiniMax')
    }

    const body = (await readJson(response)) as ImageResponse | null
    const failure = envelopeError(body?.base_resp)

    if (failure !== null) {
        throw failure
    }

    if (!response.ok) {
        throw new GenerationError(`MiniMax returned an unexpected error (${response.status}).`)
    }

    const images = (body?.data?.image_base64 ?? [])
        .filter((b64): b64 is string => typeof b64 === 'string' && b64 !== '')
        .map((b64) => decodeBase64Blob(b64, 'image/jpeg'))

    if (images.length === 0) {
        throw new GenerationError('MiniMax returned no images for this prompt.')
    }

    return images
}

interface VideoCreateResponse {
    readonly task_id?: string
    readonly base_resp?: BaseResp
}

interface VideoQueryResponse {
    readonly status?: string
    readonly file_id?: string
    readonly base_resp?: BaseResp
}

interface FileResponse {
    readonly file?: { readonly download_url?: string }
    readonly base_resp?: BaseResp
}

/** Starts the Hailuo task and returns its id. */
async function createHailuoTask(request: EngineRequest): Promise<string> {
    if (request.resolution === '1080p' && request.durationSeconds !== 6) {
        throw new GenerationError(
            'Hailuo renders 1080p clips at 6 seconds only. Pick 6s, or drop to 720p.',
        )
    }

    const reference = request.references[0]

    let created: Response

    try {
        created = await httpFetch(`${API_ROOT}/video_generation`, {
            headers: headersOf(request),
            json: {
                model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
                prompt: request.prompt,
                duration: request.durationSeconds,
                resolution: RESOLUTIONS[request.resolution] ?? '768P',
                prompt_optimizer: true,
                ...(reference === undefined
                    ? {}
                    : { first_frame_image: await encodeDataUri(reference) }),
            },
        })
    } catch {
        throw offlineError('MiniMax')
    }

    const job = (await readJson(created)) as VideoCreateResponse | null
    const createFailure = envelopeError(job?.base_resp)

    if (createFailure !== null) {
        throw createFailure
    }

    if (typeof job?.task_id !== 'string' || job.task_id === '') {
        throw new GenerationError('MiniMax accepted the run but returned no task to follow.')
    }

    return job.task_id
}

/** Trades the finished task's file id for a downloadable URL. */
async function retrieveFileUrl(request: EngineRequest, fileId: string): Promise<string> {
    const retrieved = await httpFetch(`${API_ROOT}/files/retrieve?file_id=${fileId}`, {
        headers: headersOf(request),
    })
    const file = (await readJson(retrieved)) as FileResponse | null
    const failure = envelopeError(file?.base_resp)

    if (failure !== null) {
        throw failure
    }

    const url = file?.file?.download_url

    if (typeof url !== 'string' || url === '') {
        throw new GenerationError('MiniMax finished the run but returned no video.')
    }

    return url
}

export async function generateMinimaxVideo(request: EngineRequest): Promise<Blob[]> {
    const taskId = await createHailuoTask(request)

    const finished = await poll({
        intervalMs: 10_000,
        timeoutMs: 15 * 60_000,
        timeoutMessage: 'MiniMax is still rendering after 15 minutes. Try again.',
        check: async () => {
            const response = await httpFetch(
                `${API_ROOT}/query/video_generation?task_id=${taskId}`,
                { headers: headersOf(request) },
            )
            const state = (await readJson(response)) as VideoQueryResponse | null
            const failure = envelopeError(state?.base_resp)

            if (failure !== null) {
                throw failure
            }

            if (state?.status === 'Success') {
                return state
            }

            if (state?.status === 'Fail') {
                throw new GenerationError('MiniMax could not finish this video.')
            }

            return null
        },
    })

    if (typeof finished.file_id !== 'string' || finished.file_id === '') {
        throw new GenerationError('MiniMax finished the run but returned no video.')
    }

    const url = await retrieveFileUrl(request, finished.file_id)

    return [await fetchBinary('MiniMax', url, 'video/mp4')]
}
