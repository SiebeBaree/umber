import { expect, test } from 'vitest'

import {
    fitAssets,
    intakeSlot,
    type AssetSlot,
    type ComposerAsset,
} from '../packages/ui/src/features/create/asset-fit'
// Reached by path rather than through `@umber/ui`: these are internals of the
// create feature, and unit-testing them should not force them into the
// package's public surface.
import {
    assetCapabilitiesOf,
    findModel,
    IMAGE_MODELS,
    VIDEO_MODELS,
    type Model,
} from '../packages/ui/src/features/create/catalog'

function model(mode: 'image' | 'video', id: string): Model {
    const found = findModel(mode, id)

    if (found === undefined) {
        throw new Error(`Test fixture missing model ${id}`)
    }

    return found
}

let nextId = 0

function asset(slot: AssetSlot, type = 'image/png'): ComposerAsset {
    nextId += 1

    return {
        id: `asset-${nextId}`,
        name: `file-${nextId}.png`,
        previewUrl: `blob:${nextId}`,
        file: new File([''], `file-${nextId}.png`, { type }),
        slot,
    }
}

function capabilities(mode: 'image' | 'video', id: string) {
    return assetCapabilitiesOf(model(mode, id))
}

test('every image model declares its reference rule coherently', () => {
    for (const entry of IMAGE_MODELS) {
        expect(entry.references.max).toBeGreaterThanOrEqual(0)

        if (entry.references.max > 0) {
            expect(entry.references.types.length).toBeGreaterThan(0)
        }
    }
})

test('every video model declares types for its asset slots', () => {
    for (const entry of VIDEO_MODELS) {
        expect(entry.assets.types.length).toBeGreaterThan(0)
        expect(entry.assets.referenceImages).toBeGreaterThanOrEqual(0)
    }
})

test('a set inside the limit passes through untouched', () => {
    const assets = [asset('reference'), asset('reference')]
    const fit = fitAssets(assets, capabilities('image', 'nano-banana'), 'Nano Banana')

    expect(fit.kept).toBe(assets)
    expect(fit.notice).toBeNull()
})

test('references over the limit are trimmed and said out loud', () => {
    const assets = [asset('reference'), asset('reference'), asset('reference'), asset('reference')]
    const fit = fitAssets(assets, capabilities('image', 'nano-banana'), 'Nano Banana')

    expect(fit.kept).toHaveLength(3)
    expect(fit.notice).toContain('Removed 1 image')
    expect(fit.notice).toContain('takes 3')
})

test('a type the model does not take is dropped', () => {
    // Kling Image takes JPEG and PNG only.
    const assets = [asset('reference', 'image/webp')]
    const fit = fitAssets(assets, capabilities('image', 'kling-image-2-1'), 'Kling Image 2.1')

    expect(fit.kept).toHaveLength(0)
    expect(fit.notice).toContain("doesn't take")
})

test('a model that takes no references clears the strip', () => {
    const assets = [asset('reference')]
    const fit = fitAssets(assets, capabilities('image', 'ideogram-v4'), 'Ideogram 4.0')

    expect(fit.kept).toHaveLength(0)
    expect(fit.notice).toContain("doesn't take reference images")
})

test('frames collapse into references on an image model', () => {
    const assets = [asset('start'), asset('end')]
    const fit = fitAssets(assets, capabilities('image', 'gpt-image-2'), 'GPT Image 2')

    expect(fit.kept).toHaveLength(2)
    expect(fit.kept.every((kept) => kept.slot === 'reference')).toBe(true)
})

test('the end frame is dropped for a model without one', () => {
    // Sora 2 takes a start frame only.
    const assets = [asset('start'), asset('end')]
    const fit = fitAssets(assets, capabilities('video', 'sora-2'), 'Sora 2')

    expect(fit.kept).toHaveLength(1)
    expect(fit.kept[0]?.slot).toBe('start')
    expect(fit.notice).toContain('end frame')
})

test('the end frame survives a switch between models that both take one', () => {
    const assets = [asset('start'), asset('end')]
    const fit = fitAssets(assets, capabilities('video', 'kling-2-6'), 'Kling 2.6')

    expect(fit.kept).toBe(assets)
    expect(fit.notice).toBeNull()
})

test('a reference becomes the start frame rather than being dropped', () => {
    // Wan takes a first frame and no reference images: image-mode references
    // arriving here should keep their meaning of "ground the run on this".
    const assets = [asset('reference'), asset('reference')]
    const fit = fitAssets(assets, capabilities('video', 'wan-2-6'), 'Wan 2.6')

    expect(fit.kept).toHaveLength(1)
    expect(fit.kept[0]?.slot).toBe('start')
    expect(fit.notice).toContain('start frame')
})

test('pasted and dropped files land as references when the model takes them', () => {
    expect(intakeSlot(capabilities('image', 'nano-banana'))).toBe('reference')
    // Veo 3.1 has frame slots too; references still win as the default.
    expect(intakeSlot(capabilities('video', 'veo-3-1'))).toBe('reference')
})

test('pasted and dropped files land in the start frame on a frames-only model', () => {
    expect(intakeSlot(capabilities('video', 'wan-2-6'))).toBe('start')
})

test('a model that takes no files gets no intake slot', () => {
    expect(intakeSlot(capabilities('image', 'ideogram-v4'))).toBeNull()
})

test('video reference images are kept where the model takes them', () => {
    // Veo 3.1 takes three reference images beside the frames.
    const assets = [asset('start'), asset('reference'), asset('reference')]
    const fit = fitAssets(assets, capabilities('video', 'veo-3-1'), 'Veo 3.1')

    expect(fit.kept).toBe(assets)
    expect(fit.notice).toBeNull()
})
