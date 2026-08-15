import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import { GOOGLE_API_ROOT, googleHeadersOf, googleKeyOf, toGoogleError } from './google'
import type { EngineRequest } from './request'
import { encodeBase64, fetchBinary, poll, readJson } from './shared'

/**
 * Gemini Omni Flash, split from the Veo module because it is again a different
 * lifecycle: one synchronous `interactions` call renders the whole clip, and
 * only the finished file may need a short poll before it can be downloaded.
 *
 * The model reads stills through prompt tags — `<FIRST_FRAME>` marks the
 * opening frame and `<IMAGE_REF_N>` the Nth attached image — and it picks the
 * clip length itself; there is no duration parameter to send.
 */

const OMNI_WIRE_MODEL_ID = 'gemini-omni-flash-preview'

interface InteractionContent {
    readonly type?: string
    readonly mime_type?: string
    readonly uri?: string
    readonly data?: string
}

interface InteractionResponse {
    readonly status?: string
    readonly steps?: readonly { readonly type?: string; readonly content?: InteractionContent[] }[]
    readonly error?: { readonly message?: string }
}

interface OmniFile {
    readonly state?: string
    readonly error?: { readonly message?: string }
}

/** The input array: every still inline, then the prompt with its tags. */
async function omniInput(request: EngineRequest): Promise<unknown> {
    const { firstFrame } = request
    const references = request.references.slice(0, 6)
    const stills = [...(firstFrame === undefined ? [] : [firstFrame]), ...references]

    if (stills.length === 0) {
        return request.prompt
    }

    const images = await Promise.all(
        stills.map(async (file) => ({
            type: 'image',
            data: await encodeBase64(file),
            mime_type: file.type === '' ? 'image/png' : file.type,
        })),
    )

    // The tags index the attached images in order, the opening frame first.
    const offset = firstFrame === undefined ? 0 : 1
    const tags = [
        ...(firstFrame === undefined ? [] : ['Start from <FIRST_FRAME>.']),
        ...(references.length === 0
            ? []
            : [
                  `Use ${references
                      .map((_, index) => `<IMAGE_REF_${index + offset}>`)
                      .join(', ')} as reference images.`,
              ]),
    ]

    return [...images, { type: 'text', text: `${request.prompt}\n${tags.join(' ')}` }]
}

/** The finished clip's part, wherever the interaction put it. */
function videoContentOf(body: InteractionResponse): InteractionContent | undefined {
    for (const step of body.steps ?? []) {
        const video = step.content?.find((part) => part.type === 'video')

        if (video !== undefined) {
            return video
        }
    }

    return undefined
}

/** Waits until the delivered file leaves `PROCESSING`, where it needs to. */
async function awaitOmniFile(request: EngineRequest, uri: string): Promise<void> {
    const fileId = /\/files\/([^:?]+)/u.exec(uri)?.[1]

    if (fileId === undefined) {
        return
    }

    await poll({
        intervalMs: 5000,
        timeoutMs: 5 * 60_000,
        timeoutMessage: 'Google is still preparing the clip after 5 minutes. Try again.',
        check: async () => {
            const response = await httpFetch(`${GOOGLE_API_ROOT}/files/${fileId}`, {
                headers: googleHeadersOf(request),
            })

            if (!response.ok) {
                throw await toGoogleError(response)
            }

            const file = (await readJson(response)) as OmniFile | null

            if (file?.state === 'FAILED') {
                throw new GenerationError(
                    file.error?.message ?? 'Google could not finish this video.',
                )
            }

            return file?.state === 'ACTIVE' ? file : null
        },
    })
}

/** The one synchronous interactions call, which renders the whole clip. */
async function startOmniInteraction(request: EngineRequest): Promise<InteractionResponse> {
    let response: Response

    try {
        response = await httpFetch(`${GOOGLE_API_ROOT}/interactions`, {
            headers: googleHeadersOf(request),
            json: {
                model: OMNI_WIRE_MODEL_ID,
                input: await omniInput(request),
                // Clips overflow the inline 4MB ceiling routinely, so always
                // ask for a file URI rather than branching on size.
                response_format: {
                    type: 'video',
                    aspect_ratio: request.ratio,
                    delivery: 'uri',
                },
            },
        })
    } catch {
        throw offlineError('Google')
    }

    if (!response.ok) {
        throw await toGoogleError(response)
    }

    const body = (await readJson(response)) as InteractionResponse | null

    if (body?.status === 'failed') {
        throw new GenerationError(body.error?.message ?? 'Google could not finish this video.')
    }

    return body ?? {}
}

export async function generateOmniVideo(request: EngineRequest): Promise<Blob[]> {
    const body = await startOmniInteraction(request)
    const video = videoContentOf(body)

    if (video?.uri === undefined || video.uri === '') {
        throw new GenerationError('Google finished the run but returned no video.')
    }

    await awaitOmniFile(request, video.uri)

    // The download endpoint wants the key again; queries survive redirects
    // where headers may not.
    const separator = video.uri.includes('?') ? '&' : '?'

    return [
        await fetchBinary(
            'Google',
            `${video.uri}${separator}key=${googleKeyOf(request)}`,
            'video/mp4',
        ),
    ]
}
