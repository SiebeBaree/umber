import { expect, test } from 'vitest'

import {
    IMAGE_MODELS,
    VIDEO_MODELS,
    type ImageModel,
    type VideoModel,
} from '../packages/ui/src/features/create/catalog'
import { estimateCost } from '../packages/ui/src/features/create/pricing'
import type { ModeSettings } from '../packages/ui/src/features/create/settings/schema'

/**
 * The catalog quotes each vendor's published rate, and two of them publish a
 * formula rather than a rate. These lock the computed figures to the numbers
 * on the vendors' own pricing pages, so a change to the size rules or the
 * token maths cannot quietly move what the composer promises.
 */

function image(id: string): ImageModel {
    const found = IMAGE_MODELS.find((model) => model.id === id)

    if (found === undefined) {
        throw new Error(`No image model ${id}`)
    }

    return found
}

function video(id: string): VideoModel {
    const found = VIDEO_MODELS.find((model) => model.id === id)

    if (found === undefined) {
        throw new Error(`No video model ${id}`)
    }

    return found
}

const BASE: ModeSettings = {
    modelId: '',
    aspectRatio: '1:1',
    resolution: '1K',
    quality: 'high',
    outputCount: 1,
    durationSeconds: 5,
}

const costOf = (model: ImageModel | VideoModel, settings: Partial<ModeSettings>, references = 0) =>
    estimateCost(model, { ...BASE, ...settings }, references)

test('GPT Image 2 matches the per-image figures OpenAI publishes', () => {
    const model = image('gpt-image-2')

    expect(costOf(model, { quality: 'low' })).toBeCloseTo(0.006, 3)
    expect(costOf(model, { quality: 'medium' })).toBeCloseTo(0.053, 3)
    expect(costOf(model, { quality: 'high' })).toBeCloseTo(0.211, 3)
})

test('a wide GPT Image 2 frame costs less than a square one, as OpenAI bills it', () => {
    const model = image('gpt-image-2')

    // Cost tracks the grid over the image, not the pixel count, so 4K
    // widescreen genuinely undercuts a 2K square.
    expect(costOf(model, { aspectRatio: '16:9', resolution: '4K' })).toBeLessThan(
        costOf(model, { resolution: '2K' }),
    )
})

test('the older GPT Image models match their published portrait and square prices', () => {
    expect(costOf(image('gpt-image-1-5'), {})).toBeCloseTo(0.133, 3)
    expect(costOf(image('gpt-image-1-5'), { aspectRatio: '2:3' })).toBeCloseTo(0.2, 2)
    expect(costOf(image('gpt-image-1'), { quality: 'low' })).toBeCloseTo(0.011, 3)
    expect(costOf(image('gpt-image-1'), { aspectRatio: '2:3' })).toBeCloseTo(0.25, 2)
})

test('FLUX.2 bills the first megapixel, then each one after it', () => {
    const model = image('flux-2-pro')

    expect(costOf(model, {})).toBeCloseTo(0.03, 4)
    // 2048×2048 is four megapixels: $0.03 plus three at $0.015.
    expect(costOf(model, { resolution: '2K' })).toBeCloseTo(0.075, 4)
    // Every reference image is charged as a further megapixel.
    expect(costOf(model, {}, 2)).toBeCloseTo(0.06, 4)
})

test('a flat-rate model charges the same at every resolution it offers', () => {
    // Ideogram prices by rendering speed alone, and Seedream per image.
    const ideogram = image('ideogram-v4')
    expect(costOf(ideogram, { quality: 'high' })).toBeCloseTo(0.1, 3)

    const seedream = image('seedream-4')
    expect(costOf(seedream, { resolution: '4K' })).toBeCloseTo(
        costOf(seedream, { resolution: '1K' }),
    )
})

test('video rates come from the resolution actually chosen', () => {
    const seedance = video('seedance-2-0')

    expect(costOf(seedance, { resolution: '480p', durationSeconds: 5 })).toBeCloseTo(0.35, 2)
    expect(costOf(seedance, { resolution: '4K', durationSeconds: 5 })).toBeCloseTo(3.9, 2)

    // Wan is $0.10/s at 720p and $0.15/s at 1080p.
    const wan = video('wan-2-6')
    expect(costOf(wan, { resolution: '720p', durationSeconds: 10 })).toBeCloseTo(1, 2)
    expect(costOf(wan, { resolution: '1080p', durationSeconds: 10 })).toBeCloseTo(1.5, 2)
})

test('a model quoted at 720p is not marked up for choosing 720p', () => {
    // The trap the old multiplier fell into: most video models have no 480p
    // tier, so their cheapest resolution must cost exactly the quoted rate.
    for (const model of VIDEO_MODELS) {
        const cheapest = model.resolutions[0]
        const perSecond = costOf(model, { resolution: cheapest, durationSeconds: 1 })

        expect(perSecond).toBeGreaterThan(0)

        if (typeof model.pricePerSecond === 'number') {
            expect(perSecond).toBeCloseTo(model.pricePerSecond, 6)
        } else if (typeof model.pricePerSecond === 'object') {
            expect(perSecond).toBeCloseTo(model.pricePerSecond[cheapest] ?? 0, 6)
        }
    }
})

test('every catalog model prices every combination it offers', () => {
    for (const model of [...IMAGE_MODELS, ...VIDEO_MODELS]) {
        for (const resolution of model.resolutions) {
            for (const aspectRatio of model.aspectRatios) {
                const cost = costOf(model, { resolution, aspectRatio })

                expect(Number.isFinite(cost)).toBe(true)
                expect(cost).toBeGreaterThan(0)
            }
        }
    }
})
