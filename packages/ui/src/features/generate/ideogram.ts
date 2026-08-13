import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import type { EngineRequest } from './request'
import { fetchBinary, readJson } from './shared'

/**
 * The Ideogram API: synchronous generation, one call returning every image
 * as a short-lived signed URL. The composer's quality tiers map onto
 * Ideogram's rendering speeds, which is also how Ideogram prices.
 */

const API_ROOT = 'https://api.ideogram.ai'

const WIRE_ENDPOINTS: Readonly<Record<string, string>> = {
    'ideogram-v3': 'v1/ideogram-v3/generate',
    'ideogram-v4': 'v1/ideogram-v4/generate',
}

/** Composer tier → Ideogram rendering speed. */
const RENDERING_SPEEDS: Readonly<Record<string, string>> = {
    low: 'TURBO',
    medium: 'DEFAULT',
    high: 'QUALITY',
}

interface IdeogramResponse {
    readonly data?: readonly {
        readonly url?: string | null
        readonly is_image_safe?: boolean
    }[]
    readonly error?: string
    readonly message?: string
}

async function toGenerationError(response: Response): Promise<GenerationError> {
    const body = (await readJson(response)) as IdeogramResponse | null

    if (response.status === 401 || response.status === 403) {
        return new GenerationError('Ideogram rejected the API key. Check it in Settings.')
    }

    if (response.status === 429) {
        return new GenerationError(
            'Ideogram is rate limiting this key. Give it a moment and try again.',
        )
    }

    const detail = body?.error ?? body?.message

    return new GenerationError(
        typeof detail === 'string' && detail !== ''
            ? detail
            : `Ideogram returned an unexpected error (${response.status}).`,
    )
}

function requestIdeogram(request: EngineRequest, endpoint: string): Promise<Response> {
    const headers = { 'Api-Key': request.credentials['apiKey'] ?? '' }

    // Ideogram writes ratios as 16x9; the catalog as 16:9.
    const aspectRatio = request.ratio.replace(':', 'x')
    const speed = RENDERING_SPEEDS[request.quality] ?? 'DEFAULT'

    if (request.references.length === 0) {
        return httpFetch(`${API_ROOT}/${endpoint}`, {
            headers,
            json: {
                prompt: request.prompt,
                aspect_ratio: aspectRatio,
                rendering_speed: speed,
                num_images: request.count,
            },
        })
    }

    // Reference images make it a multipart request, as style references.
    const form = new FormData()
    form.set('prompt', request.prompt)
    form.set('aspect_ratio', aspectRatio)
    form.set('rendering_speed', speed)
    form.set('num_images', String(request.count))

    for (const reference of request.references) {
        form.append('style_reference_images', reference, reference.name)
    }

    return httpFetch(`${API_ROOT}/${endpoint}`, { headers, form })
}

export async function generateIdeogramImages(request: EngineRequest): Promise<Blob[]> {
    const endpoint = WIRE_ENDPOINTS[request.modelId] ?? WIRE_ENDPOINTS['ideogram-v3'] ?? ''

    let response: Response

    try {
        response = await requestIdeogram(request, endpoint)
    } catch {
        throw offlineError('Ideogram')
    }

    if (!response.ok) {
        throw await toGenerationError(response)
    }

    const body = (await readJson(response)) as IdeogramResponse | null
    const urls = (body?.data ?? [])
        .map((entry) => entry.url)
        .filter((url): url is string => typeof url === 'string' && url !== '')

    if (urls.length === 0) {
        const filtered = (body?.data ?? []).some((entry) => entry.is_image_safe === false)

        throw new GenerationError(
            filtered
                ? 'Ideogram declined this prompt as against its usage policies.'
                : 'Ideogram returned no images for this prompt.',
        )
    }

    return Promise.all(urls.map((url) => fetchBinary('Ideogram', url, 'image/png')))
}
