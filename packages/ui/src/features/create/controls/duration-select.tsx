import { ChevronDown, Clock } from 'lucide-react'
import { Popover, Slider } from 'radix-ui'
import { useCallback, useMemo } from 'react'

import { Button } from '../../../components/ui/button'
import { cn } from '../../../lib/cn'
import { durationOptions, type DurationRule } from '../catalog'
import { LockedPill } from './locked-pill'

const PANEL_CLASSES = cn(
    'overlay-surface glass-raised z-50 w-64 origin-(--radix-popover-content-transform-origin) rounded-2xl p-4',
    'data-[state=open]:overlay-enter data-[state=closed]:overlay-exit',
)

interface DurationSliderProps {
    readonly options: readonly number[]
    readonly index: number
    readonly onIndexChange: (value: number[]) => void
}

function DurationSlider({ index, onIndexChange, options }: DurationSliderProps) {
    const value = useMemo(() => [index], [index])

    return (
        <Slider.Root
            aria-label="Clip length in seconds"
            className="relative flex h-5 w-full touch-none items-center select-none"
            max={options.length - 1}
            min={0}
            onValueChange={onIndexChange}
            step={1}
            value={value}
        >
            <Slider.Track className="relative h-1.5 grow rounded-full bg-ink/[0.12]">
                <Slider.Range className="absolute h-full rounded-full bg-accent" />
            </Slider.Track>
            <Slider.Thumb className="block size-4 cursor-grab rounded-full bg-surface shadow-[0_1px_3px_rgb(28_35_51/0.28)] outline-none transition-transform duration-150 ease-out hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:cursor-grabbing" />
        </Slider.Root>
    )
}

function DurationPanel({
    index,
    onIndexChange,
    options,
    value,
}: DurationSliderProps & { readonly value: number }) {
    return (
        <>
            <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                    Duration
                </span>
                <span className="text-sm font-semibold tabular-nums">{value}s</span>
            </div>

            <DurationSlider index={index} onIndexChange={onIndexChange} options={options} />

            <div className="mt-2 flex justify-between text-[11px] text-muted tabular-nums">
                <span>{options[0]}s</span>
                <span>{options.at(-1)}s</span>
            </div>
        </>
    )
}

function DurationTrigger({ value, ...rest }: { readonly value: number }) {
    return (
        <Button
            aria-label={`Duration: ${value} seconds`}
            className="group gap-2 ps-3 pe-3 text-[13px]"
            variant="glass"
            {...rest}
        >
            <Clock aria-hidden className="text-muted" />
            {value}s
            <ChevronDown
                aria-hidden
                className="size-3.5 text-muted transition-transform duration-200 ease-out group-data-[state=open]:rotate-180"
            />
        </Button>
    )
}

function DurationPopover(props: DurationSliderProps & { readonly value: number }) {
    return (
        <Popover.Portal>
            <Popover.Content align="start" className={PANEL_CLASSES} sideOffset={8}>
                <DurationPanel {...props} />
            </Popover.Content>
        </Popover.Portal>
    )
}

export interface DurationSelectProps {
    readonly rule: DurationRule
    readonly value: number
    readonly onValueChange: (seconds: number) => void
    readonly modelName: string
}

/**
 * Clip length, as a slider over exactly the lengths the current model allows.
 *
 * The slider runs over *indices* rather than seconds, which is what lets one
 * control serve both kinds of rule: a model offering 4/6/8s and one offering
 * every second from 3 to 12 both become an evenly spaced track with no invalid
 * position in between.
 */
export function DurationSelect({ modelName, onValueChange, rule, value }: DurationSelectProps) {
    const options = durationOptions(rule)
    const index = Math.max(0, options.indexOf(value))

    const handleChange = useCallback(
        (next: number[]) => {
            const seconds = options[next[0] ?? 0]

            if (seconds !== undefined) {
                onValueChange(seconds)
            }
        },
        [onValueChange, options],
    )

    if (options.length <= 1) {
        return (
            <LockedPill
                ariaLabel={`Duration: ${value} seconds`}
                icon={Clock}
                tooltip={`${modelName} only generates ${value}-second clips`}
                value={`${value}s`}
            />
        )
    }

    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <DurationTrigger value={value} />
            </Popover.Trigger>

            <DurationPopover
                index={index}
                onIndexChange={handleChange}
                options={options}
                value={value}
            />
        </Popover.Root>
    )
}
