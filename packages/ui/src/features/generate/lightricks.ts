import { httpFetch } from '../../lib/http'
import { ratioParts, type AspectRatio } from '../create/catalog'
import { GenerationError, offlineError } from './errors'
import type { EngineRequest } from './request'
import { encodeDataUri, fetchBinary, poll, readJson } from './shared'

/**
 * The Lightricks LTX API: async video jobs with synchronized audio on by
 * default. Jobs and their output URLs live for 24 hours, so the result is
 * downloaded as soon as the job completes.
 */

const API_ROOT = 'https://api.ltx.io'

const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'ltx-2-5-fast': 'ltx-2-5-fast',
    'ltx-2-5-pro': 'ltx-2-5-pro',
}

/** LTX takes exact pixel sizes; landscape pairs, flipped for portrait. */
const LANDSCAPE_SIZES: Readonly<Record<string, string>> = {
    '720p': '1280x720',
    '1080p': '1920x1080',
    '4K': '3840x2160',
}

function resolutionFor(ratio: AspectRatio, resolution: string): string {
    const size = LANDSCAPE_SIZES[resolution] ?? '1280x720'
    const { height, width } = ratioParts(ratio)

    if (width >= height) {
        return size
    }

    const [long, short] = size.split('x')

    return `${short}x${long}`
}

interface LtxJob {
    readonly id?: string
    readonly status?: string
    readonly result?: { readonly video_url?: string }
    readonly error?: { readonly message?: string }
}

async function toGenerationError(response: Response): Promise<GenerationError> {
    const body = (await readJson(response)) as LtxJob | null

    if (response.status === 401 || response.status === 403) {
        return new GenerationError('LTX rejected the API key. Check it in Settings.')
    }

    const detail = body?.error?.message

    return new GenerationError(
        typeof detail === 'string' && detail !== ''
            ? detail
            : `LTX returned an unexpected error (${response.status}).`,
    )
}

/** Starts the LTX job on `endpoint` and returns its id. */
async function createLtxJob(
    request: EngineRequest,
    endpoint: string,
    headers: Readonly<Record<string, string>>,
): Promise<string> {
    const reference = request.references[0]

    let created: Response

    try {
        created = await httpFetch(`${API_ROOT}/v2/${endpoint}`, {
            headers,
            json: {
                prompt: request.prompt,
                model: WIRE_MODEL_IDS[request.modelId] ?? request.modelId,
                duration: request.durationSeconds,
                resolution: resolutionFor(request.ratio, request.resolution),
                fps: 24,
                generate_audio: true,
                ...(reference === undefined ? {} : { image_uri: await encodeDataUri(reference) }),
            },
        })
    } catch {
        throw offlineError('LTX')
    }

    if (!created.ok) {
        throw await toGenerationError(created)
    }

    const job = (await readJson(created)) as LtxJob | null

    if (typeof job?.id !== 'string' || job.id === '') {
        throw new GenerationError('LTX accepted the run but returned no job to follow.')
    }

    return job.id
}

export async function generateLtxVideo(request: EngineRequest): Promise<Blob[]> {
    const headers = { Authorization: `Bearer ${request.credentials['apiKey'] ?? ''}` }
    const endpoint = request.references[0] === undefined ? 'text-to-video' : 'image-to-video'
    const jobId = await createLtxJob(request, endpoint, headers)

    const finished = await poll({
        intervalMs: 5000,
        timeoutMs: 15 * 60_000,
        timeoutMessage: 'LTX is still rendering after 15 minutes. Try again.',
        check: async () => {
            const response = await httpFetch(`${API_ROOT}/v2/${endpoint}/${jobId}`, { headers })

            if (!response.ok) {
                throw await toGenerationError(response)
            }

            const state = (await readJson(response)) as LtxJob | null

            if (state?.status === 'completed') {
                return state
            }

            if (state?.status === 'failed') {
                throw new GenerationError(
                    state.error?.message ?? 'LTX could not finish this video.',
                )
            }

            return null
        },
    })

    const url = finished.result?.video_url

    if (typeof url !== 'string' || url === '') {
        throw new GenerationError('LTX finished the run but returned no video.')
    }

    return [await fetchBinary('LTX', url, 'video/mp4')]
}
