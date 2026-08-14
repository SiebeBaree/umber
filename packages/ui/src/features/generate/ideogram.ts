import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import type { EngineRequest } from './request'
import { fetchBinary, readJson } from './shared'

/**
 * The Ideogram API: synchronous generation returning short-lived signed URLs.
 * The composer's quality tiers map onto Ideogram's rendering speeds, which is
 * also how Ideogram prices.
 *
 * The two generations do not share a request shape. V3 takes a multipart form
 * with an aspect ratio, a count and optional style references. Ideogram 4.0
 * takes `text_prompt` with an exact pixel `resolution`, renders one image per
 * call and accepts no references at all, so a multi-image run there is
 * parallel calls.
 */

const API_ROOT = 'https://api.ideogram.ai'

/** Composer tier to Ideogram rendering speed. */
const RENDERING_SPEEDS: Readonly<Record<string, string>> = {
    low: 'TURBO',
    medium: 'DEFAULT',
    high: 'QUALITY',
}

/**
 * Ideogram 4.0 picks a shape from a closed list of exact pixel sizes rather
 * than a ratio. These are the 1K entries of that list, one per ratio the
 * catalog offers for the model.
 */
const V4_RESOLUTIONS: Readonly<Record<string, string>> = {
    '1:1': '1024x1024',
    '3:2': '1248x832',
    '2:3': '832x1248',
    '4:3': '1152x864',
    '3:4': '864x1152',
    '16:9': '1280x720',
    '9:16': '720x1280',
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

function headersOf(request: EngineRequest): Readonly<Record<string, string>> {
    return { 'Api-Key': request.credentials['apiKey'] ?? '' }
}

function speedOf(request: EngineRequest): string {
    return RENDERING_SPEEDS[request.quality] ?? 'DEFAULT'
}

/** The signed URLs from one response, or the reason there are none. */
async function urlsOf(response: Response): Promise<readonly string[]> {
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

    return urls
}

/** V3: one multipart call for the whole run, references included. */
async function generateV3(request: EngineRequest): Promise<readonly string[]> {
    // Ideogram writes ratios as 16x9, the catalog as 16:9.
    const form = new FormData()
    form.set('prompt', request.prompt)
    form.set('aspect_ratio', request.ratio.replace(':', 'x'))
    form.set('rendering_speed', speedOf(request))
    form.set('num_images', String(request.count))

    for (const reference of request.references) {
        form.append('style_reference_images', reference, reference.name)
    }

    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/v1/ideogram-v3/generate`, {
            headers: headersOf(request),
            form,
        })
    } catch {
        throw offlineError('Ideogram')
    }

    return urlsOf(response)
}

/** Ideogram 4.0: one image per call, so the run fans out. */
async function generateOneV4(request: EngineRequest): Promise<string> {
    let response: Response

    try {
        response = await httpFetch(`${API_ROOT}/v1/ideogram-v4/generate`, {
            headers: headersOf(request),
            json: {
                text_prompt: request.prompt,
                resolution: V4_RESOLUTIONS[request.ratio] ?? '1024x1024',
                rendering_speed: speedOf(request),
            },
        })
    } catch {
        throw offlineError('Ideogram')
    }

    const [url] = await urlsOf(response)

    if (url === undefined) {
        throw new GenerationError('Ideogram returned no images for this prompt.')
    }

    return url
}

function generateV4(request: EngineRequest): Promise<readonly string[]> {
    if (request.references.length > 0) {
        return Promise.reject(
            new GenerationError(
                'Ideogram 4.0 cannot take reference images. Use Ideogram V3 for those.',
            ),
        )
    }

    return Promise.all(Array.from({ length: request.count }, () => generateOneV4(request)))
}

export async function generateIdeogramImages(request: EngineRequest): Promise<Blob[]> {
    const urls = await (request.modelId === 'ideogram-v4'
        ? generateV4(request)
        : generateV3(request))

    return Promise.all(urls.map((url) => fetchBinary('Ideogram', url, 'image/png')))
}
