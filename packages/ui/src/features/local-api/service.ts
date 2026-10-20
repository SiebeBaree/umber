import { durationOptions, IMAGE_MODELS, VIDEO_MODELS } from '../create/catalog'
import { getCreation, type CreationRecord } from '../gallery/creations-db'
import type { GenerationApi } from '../generate/generation-context'
import type { StartInput } from '../generate/job'
import type { KeysApi } from '../keys/keys-context'
import type { LocalApiKind, LocalApiRequest, LocalApiResponse } from './contract'
import { ApiError, costOf, defaultSettings, parseImageRequest, parseVideoRequest } from './request'

/** Keep every stored field; replace the renderer-only Blob with a downloadable resource. */
function creationMetadata(record: CreationRecord, kind: LocalApiKind) {
    const { image, ...metadata } = record
    return {
        ...metadata,
        kind,
        estimatedCost: record.estimatedCost ?? null,
        mediaType: image.type,
        sizeBytes: image.size,
        downloadUrl: `/v1/${kind}s/${record.id}/file`,
    }
}

function imageModels(keys: KeysApi) {
    return IMAGE_MODELS.map((model) => {
        const settings = defaultSettings(model)
        return {
            id: model.id,
            name: model.name,
            providerId: model.provider,
            kind: model.kind,
            connected: keys.connectedProviders.has(model.provider),
            aspectRatios: model.aspectRatios,
            resolutions: model.resolutions,
            qualities: model.quality?.options ?? [],
            maxOutputs: Math.min(4, model.maxOutputs),
            references: model.references,
            defaults: {
                aspectRatio: settings.aspectRatio,
                resolution: settings.resolution,
                quality: model.quality === undefined ? null : settings.quality,
                count: 1,
            },
        }
    })
}

function videoModels(keys: KeysApi) {
    return VIDEO_MODELS.map((model) => {
        const settings = defaultSettings(model)
        const automatic = model.durations.kind === 'automatic'
        return {
            id: model.id,
            name: model.name,
            providerId: model.provider,
            kind: model.kind,
            connected: keys.connectedProviders.has(model.provider),
            aspectRatios: model.aspectRatios,
            resolutions: model.resolutions,
            // Empty when the model picks its own clip length.
            durations: automatic ? [] : durationOptions(model.durations),
            lastFrame: model.assets.lastFrame,
            references: { max: model.assets.referenceImages, types: model.assets.types },
            defaults: {
                aspectRatio: settings.aspectRatio,
                resolution: settings.resolution,
                durationSeconds: automatic ? null : settings.durationSeconds,
            },
        }
    })
}

async function readCreation(
    action: 'read' | 'file',
    kind: LocalApiKind,
    id: unknown,
): Promise<LocalApiResponse> {
    if (typeof id !== 'string') throw new ApiError(400, 'invalid_id', 'An ID is required.')
    const record = await getCreation(id)
    // Rows stored before video existed carry no kind and are all images.
    if (record === undefined || (record.kind ?? 'image') !== kind)
        throw new ApiError(404, `${kind}_not_found`, `This ${kind} is no longer in the gallery.`)
    return action === 'file'
        ? {
              status: 200,
              bytes: new Uint8Array(await record.image.arrayBuffer()),
              mediaType: record.image.type,
          }
        : { status: 200, body: creationMetadata(record, kind) }
}

/** Same generation, persistence and usage path as the composer. */
export async function serveLocalApi(
    request: LocalApiRequest,
    keys: KeysApi,
    generation: GenerationApi,
): Promise<LocalApiResponse> {
    try {
        if (request.action === 'models') {
            const { kinds } = request.body
            return {
                status: 200,
                body: {
                    data: [
                        ...(kinds.includes('image') ? imageModels(keys) : []),
                        ...(kinds.includes('video') ? videoModels(keys) : []),
                    ],
                },
            }
        }
        if (request.action === 'read' || request.action === 'file')
            return await readCreation(request.action, request.kind, request.body)
        const input =
            request.kind === 'image'
                ? await parseImageRequest(request.body)
                : parseVideoRequest(request.body)
        if (request.action === 'estimate')
            return { status: 200, body: { ...costOf(input), settings: input.settings } }
        if (!keys.connectedProviders.has(input.model.provider))
            throw new ApiError(
                409,
                'provider_not_connected',
                "Connect this model's provider in Umber Settings first.",
            )
        return await generate(input, request.kind, generation)
    } catch (error: unknown) {
        return error instanceof ApiError
            ? {
                  status: error.status,
                  body: { error: { code: error.code, message: error.message } },
              }
            : {
                  status: 500,
                  body: {
                      error: {
                          code: 'internal_error',
                          message: 'Umber could not complete this request.',
                      },
                  },
              }
    }
}

async function generate(
    input: StartInput,
    kind: LocalApiKind,
    generation: GenerationApi,
): Promise<LocalApiResponse> {
    const cost = costOf(input)
    const result = await generation.start(input)
    if ('error' in result) throw new ApiError(502, 'generation_failed', result.error)
    const { outputs: _outputs, ...job } = result.outcome
    const creations = await Promise.all(
        result.records.map(async (record) => ({
            ...creationMetadata(record, kind),
            // Preserve paid outputs even if local storage is full. Only this exceptional
            // case embeds a file in the response instead of keeping JSON lightweight.
            ...(result.persisted
                ? {}
                : { downloadUrl: null, base64: await blobBase64(record.image) }),
        })),
    )
    return {
        status: 200,
        body: {
            ...job,
            ...cost,
            estimatedTotalCost:
                cost.estimatedCost === null ? null : cost.estimatedCost * creations.length,
            requestedEstimatedCost: cost.estimatedTotalCost,
            persisted: result.persisted,
            failures: result.failures,
            outputs: creations,
        },
    }
}

function blobBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.addEventListener('load', () => resolve(String(reader.result).split(',')[1] ?? ''))
        reader.addEventListener('error', () =>
            reject(new Error('Could not read the generated file.')),
        )
        reader.readAsDataURL(blob)
    })
}
