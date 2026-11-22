import { httpFetch } from '../../lib/http'
import { pixelSize } from '../create/catalog'
import { GenerationError, offlineError, unexpectedError } from './errors'
import type { EngineRequest } from './request'
import { fanOut, fetchBinary, readJson } from './shared'

/**
 * The Ideogram API: synchronous generation returning short-lived signed URLs.
 * The composer's quality tiers map onto Ideogram's rendering speeds, which is
 * also how Ideogram prices.
 *
 * The two generations do not share a request shape. V3 takes a multipart form
 * with an aspect ratio, a count and optional style references. Ideogram 4.0
 * takes `text_prompt` with an exact pixel `resolution`, renders one image per
 * call and accepts no references at all, so a multi-image run there is
 * parallel calls. 4.5 and 4.6 share the v2 multipart endpoint shape.
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

function toGenerationError(response: Response): GenerationError {
    if (response.status === 401 || response.status === 403) {
        return new GenerationError('Ideogram rejected the API key. Check it in Settings.')
    }

    if (response.status === 429) {
        return new GenerationError(
            'Ideogram is rate limiting this key. Give it a moment and try again.',
        )
    }

    return unexpectedError('Ideogram', response.status)
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
        throw toGenerationError(response)
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

/**
 * Ideogram 4.0: one image per call, so the run fans out. The download happens
 * inside the attempt rather than after the whole fan-out, so a link that fails
 * to fetch costs one image rather than all of them.
 */
async function generateOneV4(request: EngineRequest): Promise<Blob> {
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

    return fetchBinary('Ideogram', url, 'image/png')
}

function generateV4(request: EngineRequest): Promise<Blob[]> {
    if (request.references.length > 0) {
        return Promise.reject(
            new GenerationError(
                'Ideogram 4.0 cannot take reference images. Use Ideogram V3 for those.',
            ),
        )
    }

    return fanOut(request, () => generateOneV4(request))
}

/**
 * 4.5 and 4.6 take exact sizes on a 32 grid. Ideogram bills by the resolved
 * pixel count, so each tier is capped at its own square budget: a wide 2K
 * frame that snapped past 2048x2048 would be billed as 4K. Only 4.6 offers 4K.
 */
function v2SizeOf(request: EngineRequest): string {
    const edge = request.resolution === '4K' ? 4096 : request.resolution === '2K' ? 2048 : 1024
    const { width, height } = pixelSize(request.ratio, request.resolution, {
        tiers: { [request.resolution]: edge ** 2 },
        grid: 32,
        minEdge: 256,
        maxEdge: 8192,
        maxPixels: edge ** 2,
    })
    return `${width}x${height}`
}

/** 4.5 and 4.6 accept source images and explicit quality through the v2 multipart API. */
async function generateV2(request: EngineRequest): Promise<readonly string[]> {
    const form = new FormData()
    form.set('prompt', request.prompt)
    form.set('size', v2SizeOf(request))
    form.set('quality', request.quality)
    form.set('num_images', String(request.count))
    for (const reference of request.references) {
        form.append('images', reference, reference.name)
    }
    let response: Response
    try {
        const version = request.modelId === 'ideogram-v4-6' ? '4-6' : '4-5'
        response = await httpFetch(`${API_ROOT}/v2/image/generate/ideogram-${version}`, {
            headers: headersOf(request),
            form,
        })
    } catch {
        throw offlineError('Ideogram')
    }
    return urlsOf(response)
}

export async function generateIdeogramImages(request: EngineRequest): Promise<Blob[]> {
    if (request.modelId === 'ideogram-v4') {
        return generateV4(request)
    }

    const v2 = request.modelId === 'ideogram-v4-5' || request.modelId === 'ideogram-v4-6'
    const urls = v2 ? await generateV2(request) : await generateV3(request)

    return Promise.all(urls.map((url) => fetchBinary('Ideogram', url, 'image/png')))
}
