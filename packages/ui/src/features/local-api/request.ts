import { z } from 'zod'

import {
    durationOptions,
    IMAGE_MODELS,
    VIDEO_MODELS,
    type ImageModel,
    type Model,
    type VideoModel,
} from '../create/catalog'
import { firstImageRatio } from '../create/first-image-ratio'
import { estimateCost } from '../create/pricing'
import { reconcileToModel } from '../create/settings/reconcile'
import type { StartInput } from '../generate/job'

export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message)
    }
}

const referenceSchema = z.strictObject({
    name: z.string().min(1).max(255).default('reference'),
    mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
    base64: z.string().min(4).max(14_000_000),
})

type Reference = z.output<typeof referenceSchema>

const promptSchema = z
    .string()
    .min(1)
    .max(32_000)
    .refine((text) => text.trim().length > 0)

export const imageRequestSchema = z.strictObject({
    model: z.string().min(1),
    prompt: promptSchema,
    aspectRatio: z.string().optional(),
    resolution: z.string().optional(),
    quality: z.string().optional(),
    count: z.number().int().min(1).max(4).default(1),
    references: z.array(referenceSchema).max(16).default([]),
})

export const videoRequestSchema = z.strictObject({
    model: z.string().min(1),
    prompt: promptSchema,
    aspectRatio: z.string().optional(),
    resolution: z.string().optional(),
    durationSeconds: z.number().positive().optional(),
    firstFrame: referenceSchema.optional(),
    lastFrame: referenceSchema.optional(),
    references: z.array(referenceSchema).max(32).default([]),
})

/** The composer's first-launch settings for `model`, which the API uses for omitted fields. */
export function defaultSettings(model: Model) {
    return reconcileToModel(
        {
            modelId: model.id,
            aspectRatio: model.aspectRatios[0],
            resolution: model.resolutions[0],
            quality: 'medium',
            outputCount: 1,
            durationSeconds:
                model.kind === 'image' ? 5 : (durationOptions(model.durations)[0] ?? 5),
        },
        model,
    )
}

function referenceFile(reference: Reference): File {
    if (
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(reference.base64)
    ) {
        throw new ApiError(
            400,
            'invalid_reference',
            'References must contain standard base64 without a data URL prefix.',
        )
    }
    const bytes = Uint8Array.from(
        atob(reference.base64),
        (character) => character.codePointAt(0) ?? 0,
    )
    if (bytes.length > 10 * 1024 * 1024) {
        throw new ApiError(413, 'reference_too_large', 'Each reference must be at most 10 MiB.')
    }
    return new File([bytes], reference.name, { type: reference.mediaType })
}

function parse<Schema extends z.ZodType>(schema: Schema, body: unknown): z.output<Schema> {
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        throw new ApiError(
            400,
            'invalid_request',
            parsed.error.issues
                .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
                .join('; '),
        )
    }
    return parsed.data
}

/** Applies the controls both kinds share: an exact listed resolution and aspect ratio. */
function shared(
    request: {
        readonly resolution?: string | undefined
        readonly aspectRatio?: string | undefined
    },
    model: Model,
    settings: ReturnType<typeof defaultSettings>,
) {
    if (request.resolution !== undefined) {
        if (!model.resolutions.some((value) => value === request.resolution))
            throw new ApiError(400, 'invalid_resolution', 'Use a resolution from GET /v1/models.')
        settings.resolution = request.resolution
    }
    if (request.aspectRatio !== undefined && request.aspectRatio !== 'first-image') {
        if (!model.aspectRatios.some((value) => value === request.aspectRatio))
            throw new ApiError(
                400,
                'invalid_aspect_ratio',
                model.kind === 'image'
                    ? 'Use an aspect ratio from GET /v1/models or first-image with a reference.'
                    : 'Use an aspect ratio from GET /v1/models.',
            )
        settings.aspectRatio = request.aspectRatio
    }
}

function imageSettings(request: z.output<typeof imageRequestSchema>, model: ImageModel) {
    const settings = { ...defaultSettings(model), outputCount: request.count }
    if (request.count > model.maxOutputs)
        throw new ApiError(
            400,
            'invalid_count',
            `${model.name} allows up to ${Math.min(4, model.maxOutputs)} images.`,
        )
    shared(request, model, settings)
    if (request.quality !== undefined) {
        if (!model.quality?.options.some((value) => value === request.quality))
            throw new ApiError(
                400,
                'invalid_quality',
                'Use a quality from GET /v1/models, or omit quality for models without tiers.',
            )
        settings.quality = request.quality
    }
    if (
        request.references.length > model.references.max ||
        request.references.some(
            (reference) => !model.references.types.includes(reference.mediaType),
        )
    ) {
        throw new ApiError(
            400,
            'invalid_references',
            'Use the reference count and media types listed for this model in GET /v1/models.',
        )
    }
    return settings
}

/** Reject unsupported controls before a provider can incur a charge. */
export async function parseImageRequest(body: unknown): Promise<StartInput> {
    const request = parse(imageRequestSchema, body)
    const model = IMAGE_MODELS.find((candidate) => candidate.id === request.model)
    if (model === undefined)
        throw new ApiError(
            400,
            'unknown_image_model',
            'Choose an image model from GET /v1/models. Video models use /v1/videos.',
        )
    const settings = imageSettings(request, model)
    const references = request.references.map(referenceFile)
    if (request.aspectRatio === 'first-image') {
        settings.aspectRatio = await firstImageRatio(references[0], model).catch(
            (error: unknown) => {
                throw new ApiError(
                    400,
                    'invalid_reference',
                    error instanceof Error ? error.message : 'Could not read the first image.',
                )
            },
        )
    }
    return { model, prompt: request.prompt, settings, references }
}

function videoSettings(request: z.output<typeof videoRequestSchema>, model: VideoModel) {
    const settings = defaultSettings(model)
    if (request.aspectRatio === 'first-image')
        throw new ApiError(400, 'invalid_aspect_ratio', 'Use an aspect ratio from GET /v1/models.')
    shared(request, model, settings)
    if (request.durationSeconds !== undefined) {
        if (model.durations.kind === 'automatic')
            throw new ApiError(
                400,
                'invalid_duration',
                `${model.name} picks its own clip length. Omit durationSeconds.`,
            )
        if (!durationOptions(model.durations).includes(request.durationSeconds))
            throw new ApiError(400, 'invalid_duration', 'Use a duration from GET /v1/models.')
        settings.durationSeconds = request.durationSeconds
    }
    const images = [request.firstFrame, request.lastFrame, ...request.references].filter(
        (image) => image !== undefined,
    )
    if (
        (request.lastFrame !== undefined && (!model.assets.lastFrame || !request.firstFrame)) ||
        request.references.length > model.assets.referenceImages ||
        images.some((image) => !model.assets.types.includes(image.mediaType))
    ) {
        throw new ApiError(
            400,
            'invalid_references',
            'Use the frames, reference count and media types listed for this model in GET /v1/models. A lastFrame needs a firstFrame.',
        )
    }
    return settings
}

/** The video counterpart of `parseImageRequest`, with the composer's frame slots. */
export function parseVideoRequest(body: unknown): StartInput {
    const request = parse(videoRequestSchema, body)
    const model = VIDEO_MODELS.find((candidate) => candidate.id === request.model)
    if (model === undefined)
        throw new ApiError(
            400,
            'unknown_video_model',
            'Choose a video model from GET /v1/models. Image models use /v1/images.',
        )
    const settings = videoSettings(request, model)
    return {
        model,
        prompt: request.prompt,
        settings,
        references: request.references.map(referenceFile),
        ...(request.firstFrame === undefined
            ? {}
            : { firstFrame: referenceFile(request.firstFrame) }),
        ...(request.lastFrame === undefined ? {} : { lastFrame: referenceFile(request.lastFrame) }),
    }
}

/** Same figures as the Generate button, which also prices a first frame as a reference. */
export function costOf(input: StartInput) {
    const references = input.references.length + (input.firstFrame === undefined ? 0 : 1)
    return {
        currency: 'USD',
        estimatedCost: estimateCost(input.model, { ...input.settings, outputCount: 1 }, references),
        estimatedTotalCost: estimateCost(input.model, input.settings, references),
        actualCost: null,
        note: 'Catalog estimate, not a provider bill. Input charges may be excluded. Null means unknown.',
    }
}
