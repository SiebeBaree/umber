import { Images, Minus, Plus } from 'lucide-react'
import { AnimatePresence, motion, type Transition } from 'motion/react'
import { useCallback } from 'react'

import { Tooltip } from '../../../components/ui/tooltip'
import { cn } from '../../../lib/cn'

/** Loose enough to overshoot: the number should land like a bubble, not a counter. */
const POP: Transition = { type: 'spring', stiffness: 480, damping: 17, mass: 0.6 }

const ENTER = { scale: 0.4, opacity: 0, y: 10 }
const RESTING = { scale: 1, opacity: 1, y: 0 }
const EXIT = { scale: 0.4, opacity: 0, y: -10 }

const STEP_CLASSES = cn(
    'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors duration-150 ease-out outline-none',
    'hover:bg-[var(--umber-hover-tint)] hover:text-ink focus-visible:outline-2 focus-visible:outline-accent',
    'disabled:pointer-events-none disabled:opacity-35',
)

/** The count itself, popping in each time it changes. */
function CountBubble({ value }: { readonly value: number }) {
    return (
        // Fixed width so the surrounding pill never resizes as digits swap.
        <span className="relative flex h-5 w-4 items-center justify-center">
            <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                    animate={RESTING}
                    className="text-[13px] font-semibold tabular-nums"
                    exit={EXIT}
                    initial={ENTER}
                    key={value}
                    transition={POP}
                >
                    {value}
                </motion.span>
            </AnimatePresence>
        </span>
    )
}

export interface OutputCountStepperProps {
    readonly value: number
    readonly max: number
    readonly min?: number | undefined
    readonly onValueChange: (value: number) => void
    /** What is being counted, singular; announced on every control. */
    readonly noun?: string | undefined
    readonly tooltip?: string | undefined
}

const IMAGE_COUNT_TOOLTIP = 'How many images to generate in one run'

/**
 * How many images one run should produce. A stepper rather than a menu — the
 * range is tiny, and −/+ is one click per change instead of three. Templates
 * reuses it to size a set of photos.
 */
export function OutputCountStepper(props: OutputCountStepperProps) {
    const { max, min = 1, noun = 'image', onValueChange, tooltip, value } = props

    const decrease = useCallback(() => {
        onValueChange(Math.max(min, value - 1))
    }, [min, onValueChange, value])

    const increase = useCallback(() => {
        onValueChange(Math.min(max, value + 1))
    }, [max, onValueChange, value])

    return (
        <Tooltip label={tooltip ?? IMAGE_COUNT_TOOLTIP}>
            {/* `select-none` is the point of the wrapper: without it, hammering
                the + button double-clicks the count and leaves it highlighted. */}
            <fieldset
                aria-label={`Number of ${noun}s: ${value}`}
                className="glass-control flex h-9 items-center gap-0.5 rounded-full ps-2 pe-1 select-none"
            >
                <Images aria-hidden className="me-1 size-4 shrink-0 text-muted" />

                <button
                    aria-label={`One fewer ${noun}`}
                    className={STEP_CLASSES}
                    disabled={value <= min}
                    onClick={decrease}
                    type="button"
                >
                    <Minus aria-hidden className="size-3.5" />
                </button>

                <CountBubble value={value} />

                <button
                    aria-label={`One more ${noun}`}
                    className={STEP_CLASSES}
                    disabled={value >= max}
                    onClick={increase}
                    type="button"
                >
                    <Plus aria-hidden className="size-3.5" />
                </button>
            </fieldset>
        </Tooltip>
    )
}
