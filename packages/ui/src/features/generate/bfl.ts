import { httpFetch } from '../../lib/http'
import { FLUX_1_1_SIZE, FLUX_2_SIZE, pixelSize } from '../create/catalog'
import { GenerationError, offlineError } from './errors'
import type { KeyVerification } from './openai'
import type { EngineRequest } from './request'
import { encodeBase64, encodeDataUri, fetchBinary, poll, readJson } from './shared'

/**
 * The Black Forest Labs API. Every model is async: POST returns a polling
 * URL, `Ready` carries a signed delivery URL that lives ten minutes, so the
 * result is fetched the moment it appears. FLUX.3 Video rides the same task
 * flow as the image models, just slower.
 */

const API_ROOT = 'https://api.bfl.ai/v1'

/** Catalog id → endpoint path segment. */
const WIRE_MODEL_IDS: Readonly<Record<string, string>> = {
    'flux-2-pro': 'flux-2-pro',
    'flux-1-kontext-pro': 'flux-kontext-pro',
    'flux-pro-1-1': 'flux-pro-1.1',
}

interface BflTask {
    readonly id?: string
    readonly polling_url?: string
    readonly status?: string
    readonly result?: { readonly sample?: string }
    readonly details?: unknown
    readonly message?: string
}

async function toGenerationError(response: Response): Promise<GenerationError> {
    const body = (await readJson(response)) as BflTask | null

    if (response.status === 401 || response.status === 403) {
        return new GenerationError('Black Forest Labs rejected the API key. Check it in Settings.')
    }

    if (response.status === 402) {
        return new GenerationError(
            'Your Black Forest Labs account is out of credits. Top up in the BFL portal.',
        )
    }

    if (response.status === 429) {
        return new GenerationError(
            'Black Forest Labs is rate limiting this key. Give it a moment and try again.',
        )
    }

    return new GenerationError(
        typeof body?.message === 'string' && body.message !== ''
            ? body.message
            : `Black Forest Labs returned an unexpected error (${response.status}).`,
    )
}

/** The per-model request body, honouring each family's own size vocabulary. */
async function payloadFor(request: EngineRequest): Promise<Record<string, unknown>> {
    const base = { prompt: request.prompt, output_format: 'png' }
    const references = request.references

    if (request.modelId === 'flux-1-kontext-pro') {
        const [first, second, third, fourth] = await Promise.all(
            references.slice(0, 4).map((file) => encodeBase64(file)),
        )

        return {
            ...base,
            aspect_ratio: request.ratio,
            ...(first === undefined ? {} : { input_image: first }),
            ...(second === undefined ? {} : { input_image_2: second }),
            ...(third === undefined ? {} : { input_image_3: third }),
            ...(fourth === undefined ? {} : { input_image_4: fourth }),
        }
    }

    if (request.modelId === 'flux-pro-1-1') {
        const { height, width } = pixelSize(request.ratio, '1K', FLUX_1_1_SIZE)
        const [imagePrompt] = await Promise.all(
            references.slice(0, 1).map((file) => encodeBase64(file)),
        )

        return {
            ...base,
            width,
            height,
            ...(imagePrompt === undefined ? {} : { image_prompt: imagePrompt }),
        }
    }

    // FLUX.2: free-form sizes, up to eight reference images.
    const { height, width } = pixelSize(request.ratio, request.resolution, FLUX_2_SIZE)
    const encoded = await Promise.all(references.slice(0, 8).map((file) => encodeBase64(file)))
    const referenceFields = Object.fromEntries(
        encoded.map((image, index) => [
            index === 0 ? 'input_image' : `input_image_${index + 1}`,
            image,
        ]),
    )

    return { ...base, width, height, ...referenceFields }
}

/** Polls the task until `Ready` and hands back the signed sample URL. */
async function awaitSample(
    headers: Readonly<Record<string, string>>,
    pollingUrl: string,
    timeoutMinutes = 5,
): Promise<string> {
    const finished = await poll({
        intervalMs: 1500,
        timeoutMs: timeoutMinutes * 60_000,
        timeoutMessage: `Black Forest Labs is still rendering after ${timeoutMinutes} minutes. Try again.`,
        check: async () => {
            const response = await httpFetch(pollingUrl, { headers })

            if (!response.ok) {
                throw await toGenerationError(response)
            }

            const state = (await readJson(response)) as BflTask | null

            if (state?.status === 'Ready') {
                return state
            }

            if (state?.status === 'Request Moderated' || state?.status === 'Content Moderated') {
                throw new GenerationError(
                    'Black Forest Labs declined this prompt as against its usage policies.',
                )
            }

            if (state?.status === 'Error' || state?.status === 'Task not found') {
                throw new GenerationError('Black Forest Labs could not finish this run.')
            }

            // Pending, Reasoning and Generating all mean "keep waiting".
            return null
        },
    })

    const sample = finished.result?.sample

    if (typeof sample !== 'string' || sample === '') {
        throw new GenerationError('Black Forest Labs finished the run but returned no image.')
    }

    return sample
}

/** One image per task, so a multi-image run is parallel tasks. */
async function generateOneImage(request: EngineRequest): Promise<Blob> {
    const headers = { 'x-key': request.credentials['apiKey'] ?? '' }
    const path = WIRE_MODEL_IDS[request.modelId] ?? request.modelId

    let created: Response

    try {
        created = await httpFetch(`${API_ROOT}/${path}`, {
            headers,
            json: await payloadFor(request),
        })
    } catch {
        throw offlineError('Black Forest Labs')
    }

    if (!created.ok) {
        throw await toGenerationError(created)
    }

    const task = (await readJson(created)) as BflTask | null
    const pollingUrl =
        typeof task?.polling_url === 'string' && task.polling_url !== ''
            ? task.polling_url
            : typeof task?.id === 'string' && task.id !== ''
              ? `${API_ROOT}/get_result?id=${task.id}`
              : null

    if (pollingUrl === null) {
        throw new GenerationError(
            'Black Forest Labs accepted the run but returned no job to follow.',
        )
    }

    const sample = await awaitSample(headers, pollingUrl)

    return fetchBinary('Black Forest Labs', sample, 'image/png')
}

export function generateBflImages(request: EngineRequest): Promise<Blob[]> {
    return Promise.all(Array.from({ length: request.count }, () => generateOneImage(request)))
}

/** FLUX.3 speaks lowercase bands; the catalog's tiers name the same pixels. */
const FLUX_3_RESOLUTIONS: Readonly<Record<string, string>> = {
    '720p': 'hd',
    '1080p': 'fhd',
}

/**
 * The keyframes field: a bare still is the opening frame, and a closing frame
 * is pinned to the clip's last second with a timestamped pair.
 */
async function fluxVideoKeyframes(request: EngineRequest): Promise<unknown> {
    const { firstFrame, lastFrame } = request

    if (lastFrame !== undefined && firstFrame === undefined) {
        throw new GenerationError(
            'FLUX.3 renders towards an end frame only from a start frame. Add one, or remove the end frame.',
        )
    }

    if (firstFrame === undefined) {
        return undefined
    }

    const first = await encodeDataUri(firstFrame)

    if (lastFrame === undefined) {
        return first
    }

    return [
        [0, first],
        [request.durationSeconds, await encodeDataUri(lastFrame)],
    ]
}

export async function generateBflVideo(request: EngineRequest): Promise<Blob[]> {
    const headers = { 'x-key': request.credentials['apiKey'] ?? '' }
    const keyframes = await fluxVideoKeyframes(request)

    let created: Response

    try {
        created = await httpFetch(`${API_ROOT}/flux-3-video`, {
            headers,
            json: {
                prompt: request.prompt,
                mode: keyframes === undefined ? 't2v' : 'i2v',
                duration: request.durationSeconds,
                resolution: FLUX_3_RESOLUTIONS[request.resolution] ?? 'hd',
                aspect_ratio: request.ratio,
                generate_audio: true,
                ...(keyframes === undefined ? {} : { keyframes }),
            },
        })
    } catch {
        throw offlineError('Black Forest Labs')
    }

    if (!created.ok) {
        throw await toGenerationError(created)
    }

    const task = (await readJson(created)) as BflTask | null

    if (typeof task?.polling_url !== 'string' || task.polling_url === '') {
        throw new GenerationError(
            'Black Forest Labs accepted the run but returned no job to follow.',
        )
    }

    const sample = await awaitSample(headers, task.polling_url, 15)

    return [await fetchBinary('Black Forest Labs', sample, 'video/mp4')]
}

/** A free authenticated call: the account's credit balance. */
export async function verifyBflKey(apiKey: string): Promise<KeyVerification> {
    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/credits`, { headers: { 'x-key': apiKey } })
    } catch {
        return {
            ok: false,
            message: 'Could not reach Black Forest Labs. Check your connection and try again.',
        }
    }

    if (response.ok) {
        return { ok: true }
    }

    if (response.status === 401 || response.status === 403) {
        return {
            ok: false,
            message: 'Black Forest Labs rejected this key. Paste the full key from the BFL portal.',
        }
    }

    return {
        ok: false,
        message: `Black Forest Labs returned an unexpected error (${response.status}).`,
    }
}
