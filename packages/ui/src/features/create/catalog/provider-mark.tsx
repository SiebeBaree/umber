import { cn } from '../../../lib/cn'
import { PROVIDER_LOGOS } from './logos'
import type { ProviderId } from './types'

export interface ProviderMarkProps {
    readonly provider: ProviderId
    readonly className?: string | undefined
}

/**
 * A vendor's logo, inlined so it paints in `currentColor` and scales with
 * whatever size class the caller passes — see `./logos` for the artwork.
 */
export function ProviderMark({ className, provider }: ProviderMarkProps) {
    return (
        <span
            aria-hidden
            className={cn('inline-flex shrink-0 [&>svg]:size-full', className)}
            // Build-time constants from the logo files, never user input.
            dangerouslySetInnerHTML={PROVIDER_LOGOS[provider]}
        />
    )
}
