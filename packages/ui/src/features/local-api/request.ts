import { z } from 'zod'

import { IMAGE_MODELS, type ImageModel } from '../create/catalog'
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

export const imageRequestSchema = z.strictObject({
    model: z.string().min(1),
    prompt: z
        .string()
        .min(1)
        .max(32_000)
        .refine((text) => text.trim().length > 0),
    aspectRatio: z.string().optional(),
    resolution: z.string().optional(),
    quality: z.string().optional(),
    count: z.number().int().min(1).max(4).default(1),
    references: z.array(referenceSchema).max(16).default([]),
})

export function defaultSettings(model: ImageModel) {
    return reconcileToModel(
        {
            modelId: model.id,
            aspectRatio: model.aspectRatios[0],
            resolution: model.resolutions[0],
            quality: 'medium',
            outputCount: 1,
            durationSeconds: 5,
        },
        model,
    )
}

function referenceFile(reference: z.output<typeof referenceSchema>): File {
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

function requestSettings(request: z.output<typeof imageRequestSchema>, model: ImageModel) {
    const settings = { ...defaultSettings(model), outputCount: request.count }
    if (request.count > model.maxOutputs)
        throw new ApiError(
            400,
            'invalid_count',
            `${model.name} allows up to ${Math.min(4, model.maxOutputs)} images.`,
        )
    if (request.resolution !== undefined) {
        if (!model.resolutions.some((value) => value === request.resolution))
            throw new ApiError(400, 'invalid_resolution', 'Use a resolution from GET /v1/models.')
        settings.resolution = request.resolution
    }
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
    const parsed = imageRequestSchema.safeParse(body)
    if (!parsed.success) {
        throw new ApiError(
            400,
            'invalid_request',
            parsed.error.issues
                .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
                .join('; '),
        )
    }
    const request = parsed.data
    const model = IMAGE_MODELS.find((candidate) => candidate.id === request.model)
    if (model === undefined)
        throw new ApiError(
            400,
            'unknown_image_model',
            'Choose an image model from GET /v1/models. Video is not supported.',
        )
    const settings = requestSettings(request, model)
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
    } else if (request.aspectRatio !== undefined) {
        if (!model.aspectRatios.some((value) => value === request.aspectRatio))
            throw new ApiError(
                400,
                'invalid_aspect_ratio',
                'Use an aspect ratio from GET /v1/models or first-image with a reference.',
            )
        settings.aspectRatio = request.aspectRatio
    }
    return { model, prompt: request.prompt, settings, references }
}

export function costOf(input: StartInput) {
    return {
        currency: 'USD',
        estimatedCost: estimateCost(
            input.model,
            { ...input.settings, outputCount: 1 },
            input.references.length,
        ),
        estimatedTotalCost: estimateCost(input.model, input.settings, input.references.length),
        actualCost: null,
        note: 'Catalog estimate, not a provider bill. Input charges may be excluded. Null means unknown.',
    }
}
