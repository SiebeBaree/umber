import type { InputHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

/**
 * A recessed single-line field, the input counterpart of the segmented
 * control's groove, so forms sit *into* a glass surface rather than stacking
 * more glass on top of it.
 */
export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={cn(
                'h-10 w-full rounded-xl border border-ink/[0.06] bg-ink/[0.05] px-3.5 text-sm text-ink shadow-[inset_0_1px_2px_rgb(28_35_51/0.07)]',
                'transition-[border-color,background-color] duration-200 ease-out outline-none',
                'placeholder:text-muted/60',
                // Text fields match `:focus-visible` on any focus, so this is
                // the one focus treatment shared with every other control.
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                className,
            )}
            {...rest}
        />
    )
}
