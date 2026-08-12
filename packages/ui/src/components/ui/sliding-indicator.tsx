import { motion, type Transition } from 'motion/react'

import { cn } from '../../lib/cn'

/**
 * Carries the pill between segments. Stiff enough to feel immediate, bouncy
 * enough to overshoot slightly and settle back.
 */
const TRAVEL: Transition = { type: 'spring', stiffness: 520, damping: 34, mass: 0.9 }

export interface SlidingIndicatorProps {
    /**
     * Ties the indicators of one control together. Must be unique per rendered
     * control, or two controls on the same page will slide into each other.
     */
    readonly layoutId: string
    readonly className?: string | undefined
}

/**
 * The moving highlight behind the selected item of a segmented control. Render
 * it *inside* the selected item only: as selection moves, the old one unmounts
 * and the new one mounts, and Motion animates the pill across the gap.
 */
export function SlidingIndicator({ className, layoutId }: SlidingIndicatorProps) {
    return (
        <motion.span
            aria-hidden
            className="absolute inset-0 -z-10"
            layoutId={layoutId}
            transition={TRAVEL}
        >
            {/*
             * The squash is a CSS keyframe rather than a second Motion
             * animation: Motion drives this subtree's transforms itself while
             * the pill travels, and an `animate` here would simply be
             * overwritten. Remounting on every selection change restarts it.
             */}
            <span
                className={cn(
                    'segment-settle block size-full rounded-full bg-surface shadow-[0_1px_2px_rgb(28_35_51/0.16),0_4px_12px_-4px_rgb(28_35_51/0.2)]',
                    className,
                )}
            />
        </motion.span>
    )
}
