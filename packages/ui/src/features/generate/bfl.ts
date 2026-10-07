import { httpFetch } from '../../lib/http'
import { bflImagePayload } from './bfl-image-payload'
import { GenerationError, moderationError, offlineError, unexpectedError } from './errors'
import type { KeyVerification } from './openai'
import type { EngineRequest } from './request'
import { encodeDataUri, fanOut, fetchBinary, poll, readJson } from './shared'

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

function toGenerationError(response: Response): GenerationError {
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

    return unexpectedError('Black Forest Labs', response.status)
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
                throw toGenerationError(response)
            }

            const state = (await readJson(response)) as BflTask | null

            if (state?.status === 'Ready') {
                return state
            }

            if (state?.status === 'Request Moderated' || state?.status === 'Content Moderated') {
                throw moderationError('Black Forest Labs')
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
            json: await bflImagePayload(request),
        })
    } catch {
        throw offlineError('Black Forest Labs')
    }

    if (!created.ok) {
        throw toGenerationError(created)
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
    return fanOut(request, () => generateOneImage(request))
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
        throw toGenerationError(created)
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
