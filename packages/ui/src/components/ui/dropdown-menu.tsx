import { Check } from 'lucide-react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'

import { cn } from '../../lib/cn'

/**
 * A thin, glass-styled layer over Radix's dropdown menu. Only the parts Umber
 * uses are wrapped; more can be added as the design system grows.
 */

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

// Radix keeps a closing menu mounted until its animation finishes, so the exit
// keyframe is enough to get a close animation — no AnimatePresence needed.
const CONTENT_CLASSES = cn(
    'overlay-surface glass-raised z-50 min-w-44 origin-(--radix-dropdown-menu-content-transform-origin) rounded-2xl p-1.5',
    // Never taller than the space Radix measured for it, so a long menu scrolls
    // inside itself instead of running off the top or bottom of any window.
    'max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto',
    'data-[state=open]:overlay-enter data-[state=closed]:overlay-exit',
)

export function DropdownMenuContent({
    className,
    collisionPadding = 12,
    sideOffset = 8,
    ...rest
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
    return (
        <DropdownMenuPrimitive.Portal>
            <DropdownMenuPrimitive.Content
                className={cn(CONTENT_CLASSES, className)}
                collisionPadding={collisionPadding}
                sideOffset={sideOffset}
                {...rest}
            />
        </DropdownMenuPrimitive.Portal>
    )
}

export function DropdownMenuLabel({
    className,
    ...rest
}: ComponentProps<typeof DropdownMenuPrimitive.Label>) {
    return (
        <DropdownMenuPrimitive.Label
            className={cn(
                'px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase',
                className,
            )}
            {...rest}
        />
    )
}

export function DropdownMenuSeparator({
    className,
    ...rest
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
    return (
        <DropdownMenuPrimitive.Separator
            className={cn('my-1 h-px bg-ink/[0.07]', className)}
            {...rest}
        />
    )
}

export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const ITEM_CLASSES = cn(
    // Same tint as every other hover in the app; the accent is left to the
    // check mark, which is what actually carries meaning.
    'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink transition-colors duration-150 ease-out outline-none select-none',
    'data-[highlighted]:bg-[var(--umber-hover-tint)]',
)

export function DropdownMenuRadioItem({
    children,
    className,
    ...rest
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
    return (
        <DropdownMenuPrimitive.RadioItem
            className={cn(ITEM_CLASSES, 'justify-between', className)}
            {...rest}
        >
            {children}
            <DropdownMenuPrimitive.ItemIndicator>
                <Check aria-hidden className="size-4 text-accent" />
            </DropdownMenuPrimitive.ItemIndicator>
        </DropdownMenuPrimitive.RadioItem>
    )
}

/** A radio item that lays its own children out, for rows richer than a label. */
export function DropdownMenuRichRadioItem({
    className,
    ...rest
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
    return <DropdownMenuPrimitive.RadioItem className={cn(ITEM_CLASSES, className)} {...rest} />
}

export const DropdownMenuItemIndicator = DropdownMenuPrimitive.ItemIndicator
