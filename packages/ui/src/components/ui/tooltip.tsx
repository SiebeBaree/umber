import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'

const CONTENT_CLASSES = cn(
    'overlay-surface glass-raised z-50 max-w-56 origin-(--radix-tooltip-content-transform-origin) rounded-xl px-2.5 py-1.5 text-[12px] leading-snug text-ink',
    'data-[state=delayed-open]:overlay-enter data-[state=closed]:overlay-exit',
)

export interface TooltipProps {
    readonly label: ReactNode
    readonly children: ReactNode
    /** Wrap the trigger in a span — needed when the child is a disabled control. */
    readonly wrapTrigger?: boolean | undefined
}

/**
 * A short explanation on hover or focus.
 *
 * Disabled buttons fire no pointer events, so `wrapTrigger` puts a plain span
 * around the child to catch them: without it, the one case that most needs
 * explaining — a control that cannot be used — would be the one case with no
 * tooltip.
 */
export function Tooltip({ children, label, wrapTrigger = false }: TooltipProps) {
    return (
        <TooltipPrimitive.Root>
            <TooltipPrimitive.Trigger asChild>
                {wrapTrigger ? <span className="inline-flex">{children}</span> : children}
            </TooltipPrimitive.Trigger>
            <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content className={CONTENT_CLASSES} sideOffset={8}>
                    {label}
                </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
    )
}

/** Wraps the app once; `delayDuration` is the pause before any tooltip appears. */
export function TooltipProvider({ children }: { readonly children: ReactNode }) {
    return (
        <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={300}>
            {children}
        </TooltipPrimitive.Provider>
    )
}
