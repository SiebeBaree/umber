import { Switch as SwitchPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '../../lib/cn'

const TRACK_CLASSES = cn(
    // The same recessed groove as the segmented control's track, so every
    // "choose one state" control in the app shares a background language.
    'h-[26px] w-11 shrink-0 cursor-pointer rounded-full border border-ink/[0.04] bg-ink/[0.14] shadow-[inset_0_1px_2px_rgb(28_35_51/0.12)]',
    'transition-colors duration-200 ease-out outline-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'data-[state=checked]:border-accent-strong/30 data-[state=checked]:bg-accent',
    'disabled:cursor-not-allowed disabled:opacity-45',
)

const THUMB_CLASSES = cn(
    'block size-5 translate-x-[2px] rounded-full bg-surface',
    'shadow-[0_1px_3px_rgb(28_41_90/0.3),inset_0_1px_0_rgb(255_255_255/0.95)]',
    'transition-transform duration-200 ease-out',
    'data-[state=checked]:translate-x-[20px]',
)

/**
 * An on/off toggle. Purely presentational over Radix's switch, which supplies
 * the keyboard and ARIA behaviour; label it from the caller with `aria-label`
 * or an associated `<label htmlFor>`.
 */
export function Switch({ className, ...rest }: ComponentProps<typeof SwitchPrimitive.Root>) {
    return (
        <SwitchPrimitive.Root className={cn(TRACK_CLASSES, className)} {...rest}>
            <SwitchPrimitive.Thumb className={THUMB_CLASSES} />
        </SwitchPrimitive.Root>
    )
}
