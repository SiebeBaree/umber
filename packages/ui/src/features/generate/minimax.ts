import { httpFetch } from '../../lib/http'
import { GenerationError, moderationError, offlineError, unexpectedError } from './errors'
import type { EngineRequest } from './request'
import { encodeDataUri, fetchBinary, poll, readJson } from './shared'

/**
 * MiniMax's two APIs. Video is the v2 API, which is Hailuo 3: a multimodal
 * `content` list is submitted as a task, polled by id, and the finished clip
 * arrives as a plain URL. Errors ride a `base_resp` envelope beside the HTTP
 * status. Images are H3 Image on the v1 API: synchronous, OpenAI-shaped
 * generation and edit endpoints.
 */

const API_ROOT = 'https://api.minimax.io/v2'
const IMAGE_API_ROOT = 'https://api.minimax.io/v1'

/** Under MiniMax's 64 MiB request cap, with room left for the prompt and fields. */
const MAX_IMAGE_BODY_BYTES = 63 * 1024 * 1024

const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'minimax-h3-image': 'MiniMax-H3-Image',
    'minimax-h3-image-highspeed': 'MiniMax-H3-Image-Highspeed',
    'minimax-h3-highspeed': 'MiniMax-H3-Highspeed',
    'minimax-h3-lite': 'MiniMax-H3-Lite',
    'minimax-h3-max': 'MiniMax-H3-Max',
    'minimax-h3': 'MiniMax-H3',
}

/** The tier names on the wire: lowercase in the catalog, MiniMax's own casing here. */
const RESOLUTIONS: Readonly<Record<string, string>> = {
    '480p': '480P',
    '768p': '768P',
    '2K': '2K',
}

interface BaseResp {
    readonly status_code?: number
    readonly status_msg?: string
}

interface MinimaxTask {
    readonly task_id?: string
    readonly status?: string
    readonly content?: { readonly url?: string }
    readonly base_resp?: BaseResp
}

interface MinimaxQueryBody extends MinimaxTask {
    readonly task?: MinimaxTask
}

function headersOf(request: EngineRequest): Readonly<Record<string, string>> {
    return { Authorization: `Bearer ${request.credentials['apiKey'] ?? ''}` }
}

/** Translates the `base_resp` codes MiniMax uses instead of HTTP statuses. */
function checkBaseResp(base: BaseResp | undefined): void {
    const code = base?.status_code

    if (code === undefined || code === 0) {
        return
    }

    if (code === 1004 || code === 2049) {
        throw new GenerationError('MiniMax rejected the API key. Check it in Settings.')
    }

    if (code === 1002) {
        throw new GenerationError(
            'MiniMax is rate limiting this key. Give it a moment and try again.',
        )
    }

    if (code === 1008) {
        throw new GenerationError(
            'Your MiniMax account is out of credit. Top up in the MiniMax platform.',
        )
    }

    if (code === 1026) {
        throw moderationError('MiniMax')
    }

    throw new GenerationError('MiniMax could not make this one. Try again.')
}

/**
 * The content list: the prompt, then every still with its role. The API takes
 * either fixed frames or reference images in one request, never both.
 */
async function minimaxContent(request: EngineRequest): Promise<Record<string, unknown>[]> {
    const { firstFrame, lastFrame } = request
    const references = request.references.slice(0, 9)

    if ((firstFrame !== undefined || lastFrame !== undefined) && references.length > 0) {
        throw new GenerationError(
            'Hailuo takes either frames or reference images, not both. Remove one or the other.',
        )
    }

    const content: Record<string, unknown>[] = [{ type: 'text', text: request.prompt }]

    const stills: readonly (readonly [File | undefined, string])[] = [
        [firstFrame, 'first_frame'],
        [lastFrame, 'last_frame'],
        ...references.map((file) => [file, 'reference_image'] as const),
    ]

    for (const [file, role] of stills) {
        if (file !== undefined) {
            content.push({
                type: 'image_url',
                image_url: { url: await encodeDataUri(file) },
                role,
            })
        }
    }

    return content
}

/** Starts the generation task and returns its id. */
async function createTask(request: EngineRequest): Promise<string> {
    const grounded = request.firstFrame !== undefined || request.lastFrame !== undefined

    const content = await minimaxContent(request)
    let created: Response

    try {
        created = await httpFetch(`${API_ROOT}/video_generation`, {
            headers: headersOf(request),
            json: {
                model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
                content,
                duration: request.durationSeconds,
                resolution: RESOLUTIONS[request.resolution] ?? '768P',
                // Fixed frames only accept `adaptive`, which follows the still.
                ratio: grounded ? 'adaptive' : request.ratio,
            },
        })
    } catch {
        throw offlineError('MiniMax')
    }

    const body = (await readJson(created)) as MinimaxTask | null
    checkBaseResp(body?.base_resp)

    if (!created.ok) {
        throw unexpectedError('MiniMax', created.status)
    }

    if (typeof body?.task_id !== 'string' || body.task_id === '') {
        throw new GenerationError('MiniMax accepted the run but returned no task to follow.')
    }

    return body.task_id
}

export async function generateMinimaxVideo(request: EngineRequest): Promise<Blob[]> {
    const taskId = await createTask(request)

    const finished = await poll({
        intervalMs: 10_000,
        timeoutMs: 15 * 60_000,
        timeoutMessage: 'MiniMax is still rendering after 15 minutes. Try again.',
        check: async () => {
            const response = await httpFetch(`${API_ROOT}/query/video_generation/${taskId}`, {
                headers: headersOf(request),
            })

            const body = (await readJson(response)) as MinimaxQueryBody | null
            checkBaseResp(body?.base_resp)

            if (!response.ok) {
                throw unexpectedError('MiniMax', response.status)
            }

            const task = body?.task ?? body

            if (task?.status === 'succeeded') {
                return task
            }

            if (task?.status === 'failed' || task?.status === 'cancelled') {
                throw new GenerationError('MiniMax could not finish this video.')
            }

            return null
        },
    })

    const url = finished.content?.url

    if (typeof url !== 'string' || url === '') {
        throw new GenerationError('MiniMax finished the run but returned no video.')
    }

    return [await fetchBinary('MiniMax', url, 'video/mp4')]
}

interface MinimaxImagesResponse {
    readonly data?: readonly { readonly url?: string; readonly error?: unknown }[]
    readonly base_resp?: BaseResp
}

/** The image API reports whole-run failures by HTTP status, not `base_resp`. */
function imageStatusError(status: number): GenerationError {
    if (status === 401 || status === 403) {
        return new GenerationError('MiniMax rejected the API key. Check it in Settings.')
    }

    if (status === 402) {
        return new GenerationError(
            'Your MiniMax account is out of credit. Top up in the MiniMax platform.',
        )
    }

    if (status === 422) {
        return moderationError('MiniMax')
    }

    if (status === 429) {
        return new GenerationError(
            'MiniMax is rate limiting this key. Give it a moment and try again.',
        )
    }

    return unexpectedError('MiniMax', status)
}

/**
 * The edit references as data URIs, refused up front when they would push the
 * body past MiniMax's cap. Base64 grows every file by a third.
 */
function imageReferences(request: EngineRequest): Promise<{ image_url: string }[]> {
    const files = request.references.slice(0, 16)
    const encodedBytes = files.reduce((total, file) => total + (file.size * 4) / 3, 0)

    if (encodedBytes > MAX_IMAGE_BODY_BYTES) {
        throw new GenerationError(
            'These references are too large for MiniMax, which takes 64 MB per request. Use fewer or smaller images.',
        )
    }

    return Promise.all(files.map(async (file) => ({ image_url: await encodeDataUri(file) })))
}

/**
 * One H3 Image call for the whole run: generation for a bare prompt, the edits
 * endpoint when references ground it. Results come back as URLs, since the
 * base64 form has an undocumented size cap that 4K output can hit. An image
 * that fails moderation comes back as an `error` entry beside the others.
 */
export async function generateMinimaxImages(request: EngineRequest): Promise<Blob[]> {
    const references = await imageReferences(request)
    const editing = references.length > 0

    let response: Response

    try {
        response = await httpFetch(
            `${IMAGE_API_ROOT}/images/${editing ? 'edits' : 'generations'}`,
            {
                headers: headersOf(request),
                json: {
                    model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
                    prompt: request.prompt,
                    aspect_ratio: request.ratio,
                    // The tier names match the catalog's: `1K`, `2K` and `4K`.
                    area: request.resolution,
                    n: request.count,
                    response_format: 'url',
                    ...(editing ? { images: references } : {}),
                },
            },
        )
    } catch {
        throw offlineError('MiniMax')
    }

    const body = (await readJson(response)) as MinimaxImagesResponse | null
    checkBaseResp(body?.base_resp)

    if (!response.ok) {
        throw imageStatusError(response.status)
    }

    const urls = (body?.data ?? [])
        .map((entry) => entry.url)
        .filter((url): url is string => typeof url === 'string' && url !== '')

    if (urls.length === 0) {
        throw new GenerationError('MiniMax returned no images for this prompt.')
    }

    return Promise.all(urls.map((url) => fetchBinary('MiniMax', url, 'image/jpeg')))
}
