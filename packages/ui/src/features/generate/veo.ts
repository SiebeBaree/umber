import { httpFetch } from '../../lib/http'
import { GenerationError, offlineError } from './errors'
import {
    GOOGLE_API_ROOT,
    GOOGLE_WIRE_MODEL_IDS,
    googleHeadersOf,
    googleKeyOf,
    toGoogleError,
} from './google'
import type { EngineRequest } from './request'
import { encodeBase64, fetchBinary, poll, readJson } from './shared'

/**
 * Veo, split from the Gemini image module because it is a different
 * lifecycle: a long-running operation is started, polled until done, and its
 * finished clip downloaded from a keyed file URI.
 */

interface VeoOperation {
    readonly name?: string
    readonly done?: boolean
    readonly error?: { readonly message?: string }
    readonly response?: {
        readonly generateVideoResponse?: {
            readonly generatedSamples?: readonly {
                readonly video?: { readonly uri?: string }
            }[]
        }
    }
}

/** The instance payload: the prompt, plus a first frame when one grounds it. */
async function veoInstance(request: EngineRequest): Promise<Record<string, unknown>> {
    const reference = request.references[0]

    return {
        prompt: request.prompt,
        ...(reference === undefined
            ? {}
            : {
                  image: {
                      inlineData: {
                          mimeType: reference.type === '' ? 'image/png' : reference.type,
                          data: await encodeBase64(reference),
                      },
                  },
              }),
    }
}

/** Kicks off the long-running Veo operation and returns its name. */
async function startVeoOperation(request: EngineRequest): Promise<string> {
    const model = GOOGLE_WIRE_MODEL_IDS[request.modelId] ?? request.modelId

    if (request.resolution !== '720p' && request.durationSeconds !== 8) {
        throw new GenerationError(
            `Veo renders ${request.resolution} clips at 8 seconds only. Pick 8s, or drop to 720p.`,
        )
    }

    let started: Response

    try {
        started = await httpFetch(`${GOOGLE_API_ROOT}/models/${model}:predictLongRunning`, {
            headers: googleHeadersOf(request),
            json: {
                instances: [await veoInstance(request)],
                parameters: {
                    aspectRatio: request.ratio,
                    // Veo speaks lowercase (`4k`); the catalog's tiers are uppercase.
                    resolution: request.resolution.toLowerCase(),
                    durationSeconds: String(request.durationSeconds),
                    numberOfVideos: 1,
                },
            },
        })
    } catch {
        throw offlineError('Google')
    }

    if (!started.ok) {
        throw await toGoogleError(started)
    }

    const operation = (await readJson(started)) as VeoOperation | null

    if (typeof operation?.name !== 'string' || operation.name === '') {
        throw new GenerationError('Google accepted the run but returned no job to follow.')
    }

    return operation.name
}

export async function generateGoogleVideo(request: EngineRequest): Promise<Blob[]> {
    const operationName = await startVeoOperation(request)

    const finished = await poll({
        intervalMs: 10_000,
        timeoutMs: 15 * 60_000,
        timeoutMessage: 'Google is still rendering after 15 minutes. Try a shorter clip.',
        check: async () => {
            const response = await httpFetch(`${GOOGLE_API_ROOT}/${operationName}`, {
                headers: googleHeadersOf(request),
            })

            if (!response.ok) {
                throw await toGoogleError(response)
            }

            const state = (await readJson(response)) as VeoOperation | null

            if (state?.error !== undefined) {
                throw new GenerationError(
                    state.error.message ?? 'Google could not finish this video.',
                )
            }

            return state?.done === true ? state : null
        },
    })

    const uri = finished.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri

    if (typeof uri !== 'string' || uri === '') {
        throw new GenerationError('Google finished the run but returned no video.')
    }

    // The file endpoint wants the key again; queries survive its redirects
    // where headers may not.
    const separator = uri.includes('?') ? '&' : '?'

    return [
        await fetchBinary('Google', `${uri}${separator}key=${googleKeyOf(request)}`, 'video/mp4'),
    ]
}
