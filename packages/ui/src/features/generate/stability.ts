import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import type { KeyVerification } from './openai'
import type { EngineRequest } from './request'
import { decodeBase64Blob, readJson } from './shared'

/**
 * The Stability AI Stable Image API: synchronous multipart endpoints that
 * hand the image straight back as base64 — no polling, no expiring URLs.
 */

const API_ROOT = 'https://api.stability.ai'

/** Catalog id → endpoint path and, for sd3, the model form field. */
const ENDPOINTS: Readonly<Record<string, { readonly path: string; readonly model?: string }>> = {
    'stable-image-ultra': { path: 'ultra' },
    'stable-image-core': { path: 'core' },
    'stable-diffusion-3-5-large': { path: 'sd3', model: 'sd3.5-large' },
    'stable-diffusion-3-5-large-turbo': { path: 'sd3', model: 'sd3.5-large-turbo' },
}

interface StabilityJson {
    readonly image?: string
    readonly finish_reason?: string
    readonly errors?: readonly string[]
    readonly message?: string
}

async function toGenerationError(response: Response): Promise<GenerationError> {
    const body = (await readJson(response)) as StabilityJson | null

    if (response.status === 401) {
        return new GenerationError('Stability AI rejected the API key. Check it in Settings.')
    }

    if (response.status === 403) {
        return new GenerationError(
            'Stability AI declined this prompt as against its usage policies.',
        )
    }

    if (response.status === 429) {
        return new GenerationError(
            'Stability AI is rate limiting this key. Give it a moment and try again.',
        )
    }

    const detail = body?.errors?.[0] ?? body?.message

    return new GenerationError(
        typeof detail === 'string' && detail !== ''
            ? detail
            : `Stability AI returned an unexpected error (${response.status}).`,
    )
}

/** The multipart body, shaped to the endpoint's own reference-image rules. */
function stabilityForm(
    request: EngineRequest,
    endpoint: { readonly path: string; readonly model?: string },
): FormData {
    const reference = request.references[0]

    if (reference !== undefined && endpoint.path === 'core') {
        throw new GenerationError(
            'Stable Image Core does not take reference images. Remove them or switch models.',
        )
    }

    const form = new FormData()
    form.set('prompt', request.prompt)
    form.set('output_format', 'png')

    if (endpoint.model !== undefined) {
        form.set('model', endpoint.model)
    }

    if (reference === undefined) {
        form.set('aspect_ratio', request.ratio)
    } else if (endpoint.path === 'sd3') {
        // sd3 takes references as image-to-image mode, which owns the shape.
        form.set('mode', 'image-to-image')
        form.set('image', reference, reference.name)
        form.set('strength', '0.6')
    } else {
        form.set('aspect_ratio', request.ratio)
        form.set('image', reference, reference.name)
        form.set('strength', '0.4')
    }

    return form
}

/** One image per call, so a multi-image run is parallel calls. */
async function generateOneImage(request: EngineRequest): Promise<Blob> {
    const endpoint = ENDPOINTS[request.modelId] ?? { path: 'core' }
    const form = stabilityForm(request, endpoint)

    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/v2beta/stable-image/generate/${endpoint.path}`, {
            headers: {
                Authorization: `Bearer ${request.credentials['apiKey'] ?? ''}`,
                Accept: 'application/json',
            },
            form,
        })
    } catch {
        throw offlineError('Stability AI')
    }

    if (!response.ok) {
        throw await toGenerationError(response)
    }

    const body = (await readJson(response)) as StabilityJson | null

    if (body?.finish_reason === 'CONTENT_FILTERED') {
        throw new GenerationError('Stability AI filtered this result. Try rewording the prompt.')
    }

    if (typeof body?.image !== 'string' || body.image === '') {
        throw new GenerationError('Stability AI returned no image for this prompt.')
    }

    return decodeBase64Blob(body.image, 'image/png')
}

export function generateStabilityImages(request: EngineRequest): Promise<Blob[]> {
    return Promise.all(Array.from({ length: request.count }, () => generateOneImage(request)))
}

/** A free authenticated call: the account's credit balance. */
export async function verifyStabilityKey(apiKey: string): Promise<KeyVerification> {
    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/v1/user/balance`, {
            headers: { Authorization: `Bearer ${apiKey}` },
        })
    } catch {
        return {
            ok: false,
            message: 'Could not reach Stability AI. Check your connection and try again.',
        }
    }

    if (response.ok) {
        return { ok: true }
    }

    if (response.status === 401) {
        return {
            ok: false,
            message: 'Stability AI rejected this key. Paste the full key, starting with sk-.',
        }
    }

    return {
        ok: false,
        message: `Stability AI returned an unexpected error (${response.status}).`,
    }
}
