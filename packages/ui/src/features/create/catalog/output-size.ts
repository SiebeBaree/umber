import { ratioParts, type AspectRatio } from './types'

/**
 * How big a model actually renders, for the vendors that take explicit pixels
 * rather than a ratio.
 *
 * This lives beside the catalog rather than inside an integration because two
 * things need the same answer: the request, which sends the size, and the
 * price estimate, which for some vendors is a function of it. Deriving it
 * twice is how the two quietly drift apart.
 */

export interface SizeRule {
    /** Pixel budget per resolution tier the model offers. */
    readonly tiers: Readonly<Record<string, number>>
    /** Both edges are snapped to a multiple of this. */
    readonly grid: number
    readonly maxEdge: number
    readonly minEdge?: number
    /** A ceiling on width × height, where the vendor sets one. */
    readonly maxPixels?: number
}

export interface PixelSize {
    readonly width: number
    readonly height: number
}

/**
 * The size a ratio and tier resolve to under `rule`: scaled to the tier's
 * pixel budget, snapped to the grid, then pulled back under the edge and pixel
 * ceilings. The walk down is at most a step or two, and only near a ceiling.
 */
export function pixelSize(ratio: AspectRatio, resolution: string, rule: SizeRule): PixelSize {
    const { height, width } = ratioParts(ratio)
    const budget = rule.tiers[resolution] ?? Object.values(rule.tiers)[0] ?? 1_048_576

    const scale = Math.sqrt(budget / (width * height))
    const floor = rule.minEdge ?? rule.grid
    const snap = (edge: number) => Math.max(floor, Math.round(edge / rule.grid) * rule.grid)

    let pixelWidth = snap(width * scale)
    let pixelHeight = snap(height * scale)

    // Wide ratios can overshoot the edge limit before the pixel cap bites.
    const longest = Math.max(pixelWidth, pixelHeight)
    if (longest > rule.maxEdge) {
        const shrink = rule.maxEdge / longest
        pixelWidth = snap(pixelWidth * shrink)
        pixelHeight = snap(pixelHeight * shrink)
    }

    const cap = rule.maxPixels ?? Number.POSITIVE_INFINITY
    while (pixelWidth * pixelHeight > cap) {
        if (pixelWidth >= pixelHeight) {
            pixelWidth -= rule.grid
        } else {
            pixelHeight -= rule.grid
        }
    }

    return { width: pixelWidth, height: pixelHeight }
}

/** GPT Image 2 takes free-form sizes: multiples of 16, no edge past 3840, ~8.3MP. */
export const GPT_IMAGE_2_SIZE: SizeRule = {
    tiers: { '1K': 1024 * 1024, '2K': 2048 * 2048, '4K': 8_294_400 },
    grid: 16,
    maxEdge: 3840,
    maxPixels: 8_294_400,
}

/** FLUX.2 accepts free-form sizes; 32 is a safe grid and 2048 a safe edge. */
export const FLUX_2_SIZE: SizeRule = {
    tiers: { '1K': 1024 * 1024, '2K': 2048 * 2048 },
    grid: 32,
    maxEdge: 2048,
    minEdge: 256,
}

/** FLUX 1.1 is 256 to 1440 on each edge, in multiples of 32. */
export const FLUX_1_1_SIZE: SizeRule = {
    tiers: { '1K': 1024 * 1024 },
    grid: 32,
    maxEdge: 1440,
    minEdge: 256,
}
