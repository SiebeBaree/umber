import { expect, test } from 'vitest'

// Reached by path rather than through `@umber/ui`: these are internals of the
// create feature, and unit-testing them should not force them into the
// package's public surface.
import { findModel, type Model } from '../packages/ui/src/features/create/catalog'
import { estimateCost, formatCost } from '../packages/ui/src/features/create/pricing'
import {
    defaultModeSettings,
    reconcileToModel,
} from '../packages/ui/src/features/create/settings/reconcile'

function model(mode: 'image' | 'video', id: string): Model {
    const found = findModel(mode, id)

    if (found === undefined) {
        throw new Error(`Test fixture missing model ${id}`)
    }

    return found
}

test('a setting the new model supports is kept', () => {
    const nanoBananaPro = model('image', 'nano-banana-pro')
    const settings = reconcileToModel(
        { ...defaultModeSettings('image'), aspectRatio: '16:9', resolution: '4K' },
        nanoBananaPro,
    )

    expect(settings.resolution).toBe('4K')
    expect(settings.aspectRatio).toBe('16:9')
})

test('a resolution the new model cannot do falls back to that model default', () => {
    // FLUX.1 [schnell] is 1K only, so a remembered 4K has nowhere to go.
    const schnell = model('image', 'flux-1-schnell')
    const settings = reconcileToModel(
        { ...defaultModeSettings('image'), resolution: '4K' },
        schnell,
    )

    expect(settings.resolution).toBe('1K')
})

test('an aspect ratio the new model cannot do falls back to that model default', () => {
    // GPT Image 1.5 only offers the three fixed OpenAI sizes, so no 21:9.
    const gptImage15 = model('image', 'gpt-image-1-5')
    const settings = reconcileToModel(
        { ...defaultModeSettings('image'), aspectRatio: '21:9' },
        gptImage15,
    )

    expect(settings.aspectRatio).toBe('1:1')
})

test('a quality tier survives models that offer it and lies dormant elsewhere', () => {
    const gptImage2 = model('image', 'gpt-image-2')
    const schnell = model('image', 'flux-1-schnell')

    const high = reconcileToModel({ ...defaultModeSettings('image'), quality: 'high' }, gptImage2)
    expect(high.quality).toBe('high')

    // FLUX has no tiers; the remembered tier rides along untouched.
    const parked = reconcileToModel(high, schnell)
    expect(parked.quality).toBe('high')

    const restored = reconcileToModel(parked, gptImage2)
    expect(restored.quality).toBe('high')
})

test('the estimate prices tiered models off the chosen quality', () => {
    const gptImage2 = model('image', 'gpt-image-2')
    const base = { ...defaultModeSettings('image'), resolution: '1K', outputCount: 1 }

    const low = estimateCost(gptImage2, { ...base, quality: 'low' })
    const high = estimateCost(gptImage2, { ...base, quality: 'high' })

    expect(low).toBeCloseTo(0.006)
    expect(high).toBeCloseTo(0.211)
})

test('a clip length snaps to the nearest the new model allows', () => {
    // Kling 3.0 Pro offers 5/10/15; Veo 3.1 offers 4/6/8.
    const veo = model('video', 'veo-3-1')
    const settings = reconcileToModel({ ...defaultModeSettings('video'), durationSeconds: 15 }, veo)

    expect(settings.durationSeconds).toBe(8)
})

test('a clip length inside a range model is preserved exactly', () => {
    // Seedance 2.0 accepts every whole second from 3 to 12.
    const seedance = model('video', 'seedance-2-0')
    const settings = reconcileToModel(
        { ...defaultModeSettings('video'), durationSeconds: 7 },
        seedance,
    )

    expect(settings.durationSeconds).toBe(7)
})

test('the image count is clamped to what the model returns', () => {
    const gptImage2 = model('image', 'gpt-image-2')
    const settings = reconcileToModel(
        { ...defaultModeSettings('image'), outputCount: 4 },
        gptImage2,
    )

    expect(settings.outputCount).toBe(
        Math.min(4, gptImage2.kind === 'image' ? gptImage2.maxOutputs : 4),
    )
})

test('every catalog default is already valid for its own model', () => {
    for (const mode of ['image', 'video'] as const) {
        const settings = defaultModeSettings(mode)
        const chosen = model(mode, settings.modelId)

        expect(reconcileToModel(settings, chosen)).toEqual(settings)
    }
})

test('an exact price is shown without a tilde', () => {
    expect(formatCost(0.14)).toBe('$0.14')
    expect(formatCost(3.08)).toBe('$3.08')
    // Exact to the cent despite the binary floating-point drift.
    expect(formatCost(0.28 * 2.2 * 5)).toBe('$3.08')
})

test('a rounded price is marked with a tilde', () => {
    expect(formatCost(1.428)).toBe('~$1.43')
    expect(formatCost(0.039)).toBe('~$0.04')
})

test('a sub-cent price is never shown as free', () => {
    expect(formatCost(0.003)).toBe('<$0.01')
    expect(formatCost(0)).toBe('$0.00')
})

test('the estimate follows the settings that drive cost', () => {
    const gptImage2 = model('image', 'gpt-image-2')
    const base = { ...defaultModeSettings('image'), resolution: '1K', outputCount: 1 }

    const one = estimateCost(gptImage2, base)
    const two = estimateCost(gptImage2, { ...base, outputCount: 2 })
    const higher = estimateCost(gptImage2, { ...base, resolution: '4K' })

    expect(two).toBeCloseTo(one * 2)
    expect(higher).toBeGreaterThan(one)
})
