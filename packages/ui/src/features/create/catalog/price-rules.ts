import { FLUX_2_SIZE, GPT_IMAGE_2_SIZE, pixelSize } from './output-size'
import type { AspectRatio, ImageQuality, PriceContext } from './types'

/**
 * The two vendors whose price is a function rather than a rate.
 *
 * Everyone else charges a figure per image or per second that can simply be
 * written down. OpenAI bills GPT Image by output tokens, which fall out of the
 * exact pixel grid, and Black Forest Labs bills FLUX.2 by the megapixel. Both
 * are computed here from the same size the request will ask for, so the
 * estimate and the invoice agree.
 */

/** USD per million output tokens, per GPT Image model. */
const GPT_IMAGE_TOKEN_RATES: Readonly<Record<string, number>> = {
    'gpt-image-2': 30,
    'gpt-image-1-5': 32,
    'gpt-image-1': 40,
    'gpt-image-1-mini': 8,
}

/** The grid OpenAI lays over the image, per quality tier. */
const GPT_IMAGE_2_BASE: Readonly<Record<ImageQuality, number>> = { low: 16, medium: 48, high: 96 }

/**
 * OpenAI's own published calculation for GPT Image 2: a quality-sized grid
 * scaled by the shape, then weighted by the pixel count. It reproduces every
 * figure in OpenAI's per-image table exactly, including the fact that a wide
 * 4K frame costs less than a 2K square.
 */
function gptImage2Tokens(quality: ImageQuality, width: number, height: number): number {
    const base = GPT_IMAGE_2_BASE[quality]
    const longest = Math.max(width, height)
    const shortest = Math.min(width, height)
    const across = Math.round((base * shortest) / longest)
    const gridArea = width >= height ? base * across : across * base

    return Math.ceil((gridArea * (2e6 + width * height)) / 4e6)
}

/**
 * The models before GPT Image 2 render three fixed sizes, and OpenAI publishes
 * the output tokens for each. Keyed by the composer's ratios.
 */
const LEGACY_TOKENS: Readonly<
    Record<ImageQuality, Readonly<Partial<Record<AspectRatio, number>>>>
> = {
    low: { '1:1': 272, '2:3': 408, '3:2': 400 },
    medium: { '1:1': 1056, '2:3': 1584, '3:2': 1568 },
    high: { '1:1': 4160, '2:3': 6240, '3:2': 6208 },
}

/**
 * What one GPT Image render costs at a quality tier. `gpt-image-1-mini` comes
 * out under OpenAI's own quoted figures, which appear to fold in a fixed
 * prompt cost; billing follows the tokens, so the tokens are what is used.
 */
export function gptImagePrice(modelId: string, quality: ImageQuality) {
    const rate = GPT_IMAGE_TOKEN_RATES[modelId] ?? 30

    return (context: PriceContext): number => {
        if (modelId === 'gpt-image-2') {
            const { height, width } = pixelSize(context.ratio, context.resolution, GPT_IMAGE_2_SIZE)

            return (gptImage2Tokens(quality, width, height) * rate) / 1e6
        }

        const tokens = LEGACY_TOKENS[quality][context.ratio] ?? LEGACY_TOKENS[quality]['1:1'] ?? 0

        return (tokens * rate) / 1e6
    }
}

const MEGAPIXEL = 1024 * 1024

/** BFL rounds every image up to a whole megapixel, and caps output at four. */
function billedMegapixels(pixels: number): number {
    return Math.min(4, Math.max(1, Math.ceil(pixels / MEGAPIXEL)))
}

/**
 * FLUX.2 [pro]: the first megapixel of output costs $0.03 and each one after
 * it $0.015, with every reference image charged as a further megapixel.
 */
export function fluxTwoPrice(context: PriceContext): number {
    const { height, width } = pixelSize(context.ratio, context.resolution, FLUX_2_SIZE)
    const output = billedMegapixels(width * height)

    return 0.03 + 0.015 * (output - 1) + 0.015 * context.references
}
