import type { ProviderId } from '../types'
import alibaba from './alibaba.svg?raw'
import blackForestLabs from './black-forest-labs.svg?raw'
import bytedance from './bytedance.svg?raw'
import google from './google.svg?raw'
import ideogram from './ideogram.svg?raw'
import kling from './kling.svg?raw'
import minimax from './minimax.svg?raw'
import openai from './openai.svg?raw'
import recraft from './recraft.svg?raw'
import reve from './reve.svg?raw'
import runway from './runway.svg?raw'
import xai from './xai.svg?raw'

/**
 * Each vendor's own logo, taken from the company's published assets and kept
 * here as a file. They are reproduced as trademarks identifying each vendor's
 * models, not as Umber's own marks.
 *
 * The artwork is unchanged apart from colour: brand fills, gradients and
 * background tiles are stripped so every mark paints in `currentColor` and sits
 * at whatever weight surrounds it. Replacing a logo means dropping a new file
 * in here, nothing else — provided it keeps that one rule.
 *
 * The markup is inlined rather than linked, because an `<img>` cannot inherit
 * the text colour. It is wrapped for `dangerouslySetInnerHTML` once, at module
 * load, so rendering a mark allocates nothing.
 */
export const PROVIDER_LOGOS: Readonly<Record<ProviderId, { readonly __html: string }>> = {
    google: { __html: google },
    openai: { __html: openai },
    blackForestLabs: { __html: blackForestLabs },
    bytedance: { __html: bytedance },
    // Kuaishou's models all ship under the Kling brand, and so does the logo.
    kuaishou: { __html: kling },
    alibaba: { __html: alibaba },
    runway: { __html: runway },
    ideogram: { __html: ideogram },
    recraft: { __html: recraft },
    minimax: { __html: minimax },
    xai: { __html: xai },
    reve: { __html: reve },
}
