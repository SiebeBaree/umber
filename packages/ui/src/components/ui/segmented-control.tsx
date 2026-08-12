import type { LucideIcon } from 'lucide-react'
import { ToggleGroup } from 'radix-ui'
import { useCallback, useId } from 'react'

import { cn } from '../../lib/cn'
import { SlidingIndicator } from './sliding-indicator'

export interface SegmentedControlOption<Value extends string> {
    readonly value: Value
    readonly label: string
    readonly icon?: LucideIcon | undefined
}

const ITEM_CLASSES = cn(
    'relative isolate flex h-full cursor-pointer items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted transition-colors duration-200 ease-out outline-none select-none',
    'hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'data-[state=on]:font-semibold data-[state=on]:text-ink',
)

interface SegmentedControlItemProps<Value extends string> {
    readonly option: SegmentedControlOption<Value>
    readonly selected: boolean
    readonly indicatorId: string
}

function SegmentedControlItem<Value extends string>({
    indicatorId,
    option,
    selected,
}: SegmentedControlItemProps<Value>) {
    const Icon = option.icon

    return (
        <ToggleGroup.Item className={ITEM_CLASSES} value={option.value}>
            {selected ? <SlidingIndicator layoutId={indicatorId} /> : null}
            {Icon === undefined ? null : <Icon aria-hidden className="size-4" />}
            {option.label}
        </ToggleGroup.Item>
    )
}

export interface SegmentedControlProps<Value extends string> {
    /** Announced to screen readers; the control itself shows only the segments. */
    readonly 'aria-label': string
    readonly options: readonly SegmentedControlOption<Value>[]
    readonly value: Value
    readonly onValueChange: (value: Value) => void
    readonly className?: string | undefined
}

/**
 * A pill-shaped, single-choice control, 36px tall to match every other control
 * in a toolbar row. Built on Radix's toggle group for the keyboard and ARIA
 * behaviour; clicking the active segment is a no-op rather than a deselect,
 * because a segmented control always has a selection.
 */
export function SegmentedControl<Value extends string>({
    'aria-label': ariaLabel,
    className,
    onValueChange,
    options,
    value,
}: SegmentedControlProps<Value>) {
    // Scopes the sliding pill to this control, so two of them on one page do not
    // animate into each other.
    const indicatorId = useId()

    const handleValueChange = useCallback(
        (next: string) => {
            if (next !== '') {
                // Safe: Radix only reports values of the items rendered below.
                onValueChange(next as Value)
            }
        },
        [onValueChange],
    )

    return (
        <ToggleGroup.Root
            aria-label={ariaLabel}
            // A recessed track rather than another pane of glass: the moving
            // pill is white, so the groove behind it has to be darker than the
            // pill or there is nothing to tell selected from unselected.
            className={cn(
                'flex h-9 items-center rounded-full border border-ink/[0.04] bg-ink/[0.07] p-[3px] shadow-[inset_0_1px_2px_rgb(28_35_51/0.09)]',
                className,
            )}
            onValueChange={handleValueChange}
            type="single"
            value={value}
        >
            {options.map((option) => (
                <SegmentedControlItem
                    indicatorId={indicatorId}
                    key={option.value}
                    option={option}
                    selected={option.value === value}
                />
            ))}
        </ToggleGroup.Root>
    )
}
