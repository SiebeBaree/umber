import type { AspectRatio } from '../create/catalog'

/**
 * The exact pixel grids Seedream renders, one table per model generation.
 *
 * The image endpoint has no ratio parameter: a bare `2K` lets the model pick
 * a shape from the prompt, which lands square unless the prompt happens to
 * say otherwise. Sending exact pixels is the only way to honour the composer,
 * so these are ByteDance's own published dimensions per tier and ratio.
 */

const SEEDREAM_4_SIZES: Readonly<Record<string, Readonly<Partial<Record<AspectRatio, string>>>>> = {
    '1K': {
        '1:1': '1024x1024',
        '3:2': '1248x832',
        '2:3': '832x1248',
        '4:3': '1152x864',
        '3:4': '864x1152',
        '16:9': '1280x720',
        '9:16': '720x1280',
    },
    '2K': {
        '1:1': '2048x2048',
        '3:2': '2496x1664',
        '2:3': '1664x2496',
        '4:3': '2304x1728',
        '3:4': '1728x2304',
        '16:9': '2848x1600',
        '9:16': '1600x2848',
    },
    '4K': {
        '1:1': '4096x4096',
        '3:2': '4992x3328',
        '2:3': '3328x4992',
        '4:3': '4704x3520',
        '3:4': '3520x4704',
        '16:9': '5504x3040',
        '9:16': '3040x5504',
    },
}

/**
 * Seedream 5.0 lays a different grid over the same tiers — these are the
 * width/height values ByteDance's 5.0 documentation maps each ratio to, which
 * its explicit-pixel floor is calibrated against.
 */
const SEEDREAM_5_SIZES: Readonly<Record<string, Readonly<Partial<Record<AspectRatio, string>>>>> = {
    '1K': {
        '1:1': '1024x1024',
        '3:2': '1248x832',
        '2:3': '832x1248',
        '4:3': '1152x864',
        '3:4': '864x1152',
        '16:9': '1424x800',
        '9:16': '800x1424',
        '21:9': '1568x672',
    },
    '2K': {
        '1:1': '2048x2048',
        '3:2': '2496x1664',
        '2:3': '1664x2496',
        '4:3': '2368x1776',
        '3:4': '1776x2368',
        '16:9': '2816x1584',
        '9:16': '1584x2816',
        '21:9': '3136x1344',
    },
}

/** Catalog ids on the Seedream 5.0 grid rather than the 4.x one. */
const SEEDREAM_5_MODELS = new Set(['seedream-5-pro', 'seedream-5-lite', 'seedream-5-flash'])

/** Tiers from most to least pixels. */
const TIER_ORDER = ['4K', '2K', '1K']

export function seedreamSize(modelId: string, ratio: AspectRatio, resolution: string): string {
    // Lite's 4K tier falls back to the 4.x table, which 5.0 never re-mapped.
    const tables = SEEDREAM_5_MODELS.has(modelId)
        ? { ...SEEDREAM_4_SIZES, ...SEEDREAM_5_SIZES }
        : SEEDREAM_4_SIZES

    // The requested tier first, then tiers down from it: an unmapped
    // tier/ratio pair degrades to the nearest grid that does map the ratio
    // instead of silently answering a wide request with a square.
    const tiers = [resolution, ...TIER_ORDER.filter((tier) => tier !== resolution)]
    for (const tier of tiers) {
        const size = tables[tier]?.[ratio]
        if (size) return size
    }

    return '2048x2048'
}
