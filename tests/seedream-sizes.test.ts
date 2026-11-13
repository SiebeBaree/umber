// @vitest-environment node
import { expect, test } from 'vitest'

import { IMAGE_MODELS } from '../packages/ui/src/features/create/catalog'
import { seedreamSize } from '../packages/ui/src/features/generate/seedream-sizes'

test('Seedream 5 Lite 21:9 at 4K degrades to the 2K 21:9 grid entry', () => {
    // Fails today: the 4K tier comes from the 4.x table, which has no '21:9',
    // so the bare fallback answers a wide-ratio request with '2048x2048'.
    expect(seedreamSize('seedream-5-lite', '21:9', '4K')).toBe('3136x1344')
})

test('no catalog-declared ratio/resolution combination answers a square unless the ratio is square', () => {
    const seedreamModels = IMAGE_MODELS.filter((model) => model.id.startsWith('seedream'))
    expect(seedreamModels.length).toBeGreaterThan(0)

    for (const model of seedreamModels) {
        for (const ratio of model.aspectRatios) {
            for (const resolution of model.resolutions) {
                const [width, height] = seedreamSize(model.id, ratio, resolution)
                    .split('x')
                    .map(Number)
                const square = width === height
                expect(
                    square,
                    `${model.id} ${ratio} @ ${resolution} rendered ${width}x${height}`,
                ).toBe(ratio === '1:1')
            }
        }
    }
})

test('an unmapped ratio still falls back to the square default', () => {
    // '5:4' is not on any Seedream grid; the bare square fallback survives for
    // ratios the tables genuinely do not map.
    expect(seedreamSize('seedream-5-lite', '5:4' as never, '2K')).toBe('2048x2048')
})

test('Seedream 4.x lookup is unchanged', () => {
    expect(seedreamSize('seedream-4-0', '16:9', '4K')).toBe('5504x3040')
    expect(seedreamSize('seedream-4-5', '9:16', '2K')).toBe('1600x2848')
})
