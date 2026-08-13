import { X } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '../../lib/cn'

/**
 * A modal glass panel over a dimmed canvas. Like the dropdown menu, Radix keeps
 * a closing dialog mounted until its exit keyframe finishes, so both animations
 * live entirely in CSS.
 */

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

const OVERLAY_CLASSES = cn(
    'overlay-surface fixed inset-0 z-50 bg-ink/25',
    'data-[state=open]:scrim-enter data-[state=closed]:scrim-exit',
)

const CONTENT_CLASSES = cn(
    'overlay-surface glass-raised fixed top-1/2 left-1/2 z-50 flex w-[calc(100vw-3rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-3xl p-6',
    // Never taller than the window; a dialog that overflows scrolls a region
    // inside itself, which each dialog lays out for its own content.
    'max-h-[min(85vh,44rem)]',
    'data-[state=open]:dialog-enter data-[state=closed]:dialog-exit',
)

const CLOSE_CLASSES = cn(
    'tint-control absolute top-4 end-4 flex size-8 cursor-pointer items-center justify-center rounded-full text-muted outline-none hover:text-ink',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
)

/**
 * The panel itself, with the scrim behind it and an ✕ in its corner. Radix
 * wires up focus trapping, Escape and click-outside; every dialog must render
 * a `DialogTitle` so the panel has an accessible name.
 */
export function DialogContent({
    children,
    className,
    ...rest
}: ComponentProps<typeof DialogPrimitive.Content>) {
    return (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className={OVERLAY_CLASSES} />
            <DialogPrimitive.Content className={cn(CONTENT_CLASSES, className)} {...rest}>
                {children}
                <DialogPrimitive.Close asChild>
                    <button aria-label="Close" className={CLOSE_CLASSES} type="button">
                        <X aria-hidden className="size-4" />
                    </button>
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    )
}

export function DialogTitle({ className, ...rest }: ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            // Padded away from the ✕ so a long title wraps instead of colliding.
            className={cn('pe-8 text-lg font-semibold tracking-tight', className)}
            {...rest}
        />
    )
}

export function DialogDescription({
    className,
    ...rest
}: ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            className={cn('mt-1.5 text-sm leading-relaxed text-muted', className)}
            {...rest}
        />
    )
}
