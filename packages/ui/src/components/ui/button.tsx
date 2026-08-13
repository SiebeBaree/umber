import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

/**
 * Sizes are shared with every other control in the app: `md` (36px) is the
 * height of a toolbar row, and `icon` is its square counterpart, so a row of
 * mixed buttons, pickers and toggles lines up without per-component nudging.
 */
// No press-scale on the shared base: on a control that also opens something it
// reads as a stutter just before its popup appears. `primary` and `overlay`
// opt back in, where the press *is* the action and the feedback is the point.
//
// The transition list names `scale` and `opacity` alongside `transform`
// because Tailwind v4's scale/translate utilities set those standalone CSS
// properties, not `transform` — a press-scale outside the list would snap
// instead of easing.
const buttonVariants = cva(
    'inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,opacity,scale,transform] duration-200 ease-out outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                primary:
                    'bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_8px_20px_-10px_var(--umber-accent)] hover:bg-accent-strong active:scale-[0.97]',
                glass: 'glass-control text-ink',
                ghost: 'tint-control text-muted hover:text-ink',
                // The chip for controls overlaid on imagery, where glass-
                // control's bright border turns crusty: a plain bright
                // surface with only a shadow for its edge, staying with the
                // app's light palette. Used by the gallery download and the
                // composer's reference-image remove.
                overlay:
                    'bg-surface/90 text-ink shadow-[0_4px_12px_-4px_var(--umber-glass-shadow)] backdrop-blur-md hover:bg-surface active:scale-95',
            },
            size: {
                sm: 'h-8 px-3.5 text-[13px] [&_svg]:size-4',
                md: 'h-9 px-4 text-sm [&_svg]:size-4',
                icon: 'size-9 [&_svg]:size-[18px]',
                'icon-sm': 'size-8 [&_svg]:size-[18px]',
            },
        },
        defaultVariants: {
            variant: 'primary',
            size: 'md',
        },
    },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariants {
    /** Renders the child element (e.g. a router `<Link>`) with button styling. */
    readonly asChild?: boolean | undefined
}

/**
 * The design-system button. Defaults to `type="button"` so it never submits a
 * surrounding form by accident.
 */
export function Button({ asChild = false, className, size, type, variant, ...rest }: ButtonProps) {
    const Component = asChild ? Slot.Root : 'button'

    return (
        <Component
            className={cn(buttonVariants({ variant, size }), className)}
            {...(asChild ? {} : { type: type ?? 'button' })}
            {...rest}
        />
    )
}
