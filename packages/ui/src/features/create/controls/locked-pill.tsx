import type { LucideIcon } from 'lucide-react'

import { Tooltip } from '../../../components/ui/tooltip'
import { cn } from '../../../lib/cn'
import type { AspectRatio } from '../catalog'
import { AspectRatioIcon } from './aspect-ratio-icon'

export interface LockedPillProps {
    readonly icon?: LucideIcon | undefined
    /** Draws the ratio to scale instead of an icon, matching the live picker. */
    readonly ratio?: AspectRatio | undefined
    readonly value: string
    readonly ariaLabel: string
    readonly tooltip: string
}

/**
 * A setting the current model leaves no choice about.
 *
 * Shown rather than hidden, because the value still matters — it is simply not
 * yours to change. It keeps the pill's shape and loses the chevron, and it is a
 * genuinely `disabled` button so assistive tech reports it as such; the tooltip
 * carries the reason, which is why the trigger is wrapped (a disabled button
 * fires no pointer events of its own).
 */
export function LockedPill({ ariaLabel, icon: Icon, ratio, tooltip, value }: LockedPillProps) {
    return (
        <Tooltip label={tooltip} wrapTrigger>
            <button
                aria-label={ariaLabel}
                className={cn(
                    'flex h-9 cursor-default items-center gap-2 rounded-full px-3 text-[13px] font-medium whitespace-nowrap text-muted select-none',
                    'border border-ink/[0.04] bg-ink/[0.045]',
                )}
                disabled
                type="button"
            >
                {ratio === undefined ? null : (
                    <AspectRatioIcon className="size-[18px]" ratio={ratio} />
                )}
                {Icon === undefined ? null : <Icon aria-hidden className="size-4" />}
                {value}
            </button>
        </Tooltip>
    )
}
