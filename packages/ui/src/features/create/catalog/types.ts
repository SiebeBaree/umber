/**
 * The shape of Umber's model catalog.
 *
 * Capabilities are declared per model rather than per mode, because what a model
 * accepts is the only thing that may ever populate the composer's pickers — a
 * model that cannot render 4K must not be able to be asked for it.
 */

export const PROVIDER_IDS = [
    'google',
    'openai',
    'blackForestLabs',
    'bytedance',
    'kuaishou',
    'alibaba',
    'runway',
    'ideogram',
    'recraft',
    'minimax',
    'xai',
    'reve',
] as const

export type ProviderId = (typeof PROVIDER_IDS)[number]

export interface Provider {
    readonly id: ProviderId
    /** The company, not the model family — models are grouped under this. */
    readonly name: string
}

export type AspectRatio = '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '16:9' | '9:16' | '21:9'

/**
 * The two sides of a ratio, parsed once and validated loudly — the single way
 * callers read the `w:h` encoding, mirroring what `durationOptions` is for
 * `DurationRule`. Throwing beats a silent fallback: a malformed ratio fed to
 * layout maths would otherwise surface as NaN geometry far from the mistake.
 */
export function ratioParts(ratio: AspectRatio): {
    readonly width: number
    readonly height: number
} {
    const [widthPart, heightPart] = ratio.split(':')
    const width = Number(widthPart)
    const height = Number(heightPart)

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error(`Malformed aspect ratio: ${ratio}`)
    }

    return { width, height }
}

/** The ratio in CSS `aspect-ratio` syntax — `'3:2'` becomes `'3 / 2'`. */
export function ratioToCss(ratio: AspectRatio): string {
    const { height, width } = ratioParts(ratio)

    return `${width} / ${height}`
}

export type ImageResolution = '1K' | '2K' | '4K'
// MiniMax renders a 768-line tier and a 2K tier that no one else names, so
// both sit in the union alongside the common broadcast tiers.
export type VideoResolution = '480p' | '720p' | '768p' | '1080p' | '2K' | '4K'

/**
 * The render-effort tiers some models expose. Quality is priced per tier, so a
 * model that supports it carries its own price table instead of one figure.
 */
export type ImageQuality = 'low' | 'medium' | 'high'

export interface QualityRule {
    readonly options: readonly [ImageQuality, ...ImageQuality[]]
    /** USD for one image, per tier. */
    readonly pricePerImage: Readonly<Record<ImageQuality, Price>>
}

/** Everything about a run that a vendor might charge differently for. */
export interface PriceContext {
    readonly resolution: string
    readonly ratio: AspectRatio
    readonly quality: string
    /** Reference images attached, which some vendors bill for. */
    readonly references: number
}

/**
 * USD for one unit of output, meaning one image or one second of video.
 *
 * Vendors are split on how output size enters the bill. A single number is a
 * model that charges the same whatever it renders, a table is one that charges
 * per resolution tier, and a function is one that genuinely computes it, as
 * OpenAI does from output tokens and Black Forest Labs by the megapixel.
 * Every form is the vendor's own published rate, never an extrapolation.
 */
export type Price = number | Readonly<Record<string, number>> | ((context: PriceContext) => number)

/** The figure that applies to `context`, falling back to the model's cheapest tier. */
export function priceAt(price: Price, context: PriceContext, cheapest: string): number {
    if (typeof price === 'number') {
        return price
    }

    if (typeof price === 'function') {
        return price(context)
    }

    return price[context.resolution] ?? price[cheapest] ?? 0
}

/**
 * What a video model accepts for clip length. Some publish a handful of fixed
 * lengths, others any whole second inside a range, so both are expressible.
 */
export type DurationRule =
    | { readonly kind: 'list'; readonly seconds: readonly [number, ...number[]] }
    | { readonly kind: 'range'; readonly min: number; readonly max: number; readonly step: number }

/** Every allowed length, ascending — the single way callers read a rule. */
export function durationOptions(rule: DurationRule): readonly number[] {
    if (rule.kind === 'list') {
        return rule.seconds
    }

    const options: number[] = []
    for (let seconds = rule.min; seconds <= rule.max; seconds += rule.step) {
        options.push(seconds)
    }

    return options
}

/**
 * What an image model accepts alongside the prompt. Declared per model for the
 * same reason as every other capability here: the picker must not offer an
 * upload the API would reject, and the reconciler needs the numbers to trim an
 * attachment set when the user switches to a stricter model.
 */
export interface ImageReferenceRule {
    /** Most reference images the API takes in one request. Zero means none. */
    readonly max: number
    /** MIME types the API accepts. Empty when `max` is zero. */
    readonly types: readonly string[]
}

/**
 * The stills a video model can be handed. Every model in the catalog animates
 * a supplied first frame, so only what varies is declared: the closing frame,
 * and reference images that guide style or subject without being a frame.
 */
export interface VideoAssetRule {
    /** Whether the API takes an end frame to render towards. */
    readonly lastFrame: boolean
    /** Most style/subject reference images accepted beyond the frames. */
    readonly referenceImages: number
    /** MIME types the API accepts for any of these inputs. */
    readonly types: readonly string[]
}

interface ModelBase {
    readonly id: string
    readonly name: string
    readonly provider: ProviderId
    /**
     * Ordering key within a provider, newest first. An ISO date rather than a
     * version string, because version schemes differ between vendors.
     */
    readonly releasedOn: string
    readonly aspectRatios: readonly [AspectRatio, ...AspectRatio[]]
}

export interface ImageModel extends ModelBase {
    readonly kind: 'image'
    readonly resolutions: readonly [ImageResolution, ...ImageResolution[]]
    /** Most images this model will return in one request; the stepper caps at 4. */
    readonly maxOutputs: number
    /** What the model accepts as reference images. */
    readonly references: ImageReferenceRule
    /** USD for one image. Ignored when the model prices by quality tier. */
    readonly pricePerImage: Price
    /** Present only when the model trades render quality against price. */
    readonly quality?: QualityRule
    /** Only where editing a picture is billed differently from drawing one. */
    readonly pricePerImageFromImage?: Price
}

export interface VideoModel extends ModelBase {
    readonly kind: 'video'
    readonly resolutions: readonly [VideoResolution, ...VideoResolution[]]
    readonly durations: DurationRule
    /** The stills the model can be handed alongside the prompt. */
    readonly assets: VideoAssetRule
    /** USD for one second of finished clip. */
    readonly pricePerSecond: Price
    /** Only where animating a still is billed differently from text alone. */
    readonly pricePerSecondFromImage?: Price
    /** A one-off charge some vendors add for the supplied first frame. */
    readonly firstFramePrice?: number
}

export type Model = ImageModel | VideoModel

/**
 * A model's attachment rules flattened into one shape, so the composer never
 * branches on the model kind to know what the picker may offer.
 */
export interface AssetCapabilities {
    /** Whether start and end frame slots exist at all — video models only. */
    readonly frames: boolean
    /** Whether the end frame slot exists. Never true without `frames`. */
    readonly lastFrame: boolean
    /** Most plain reference images the model takes. */
    readonly maxReferences: number
    /** Accepted MIME types, ready for an `<input accept>`. */
    readonly types: readonly string[]
}

export function assetCapabilitiesOf(model: Model): AssetCapabilities {
    if (model.kind === 'image') {
        return {
            frames: false,
            lastFrame: false,
            maxReferences: model.references.max,
            types: model.references.types,
        }
    }

    return {
        frames: true,
        lastFrame: model.assets.lastFrame,
        maxReferences: model.assets.referenceImages,
        types: model.assets.types,
    }
}
