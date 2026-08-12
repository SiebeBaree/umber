import { useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

/** Milliseconds per character. Deleting is quicker than typing, as it is by hand. */
const TYPE_STEP = 55
const DELETE_STEP = 28

/** How long a finished sentence sits there before it starts erasing. */
const HOLD = 2200

type Phase = 'typing' | 'holding' | 'deleting'

interface TypingState {
    readonly endingIndex: number
    readonly visibleCount: number
    readonly phase: Phase
}

const INITIAL: TypingState = { endingIndex: 0, visibleCount: 0, phase: 'typing' }

function stepDelay(phase: Phase): number {
    if (phase === 'holding') {
        return HOLD
    }

    return phase === 'deleting' ? DELETE_STEP : TYPE_STEP
}

/** One character of progress, or the switch to the next phase. */
function advance(state: TypingState, endingLength: number, endingCount: number): TypingState {
    if (state.phase === 'holding') {
        return { ...state, phase: 'deleting' }
    }

    if (state.phase === 'deleting') {
        return state.visibleCount === 0
            ? {
                  endingIndex: (state.endingIndex + 1) % endingCount,
                  visibleCount: 0,
                  phase: 'typing',
              }
            : { ...state, visibleCount: state.visibleCount - 1 }
    }

    return state.visibleCount === endingLength
        ? { ...state, phase: 'holding' }
        : { ...state, visibleCount: state.visibleCount + 1 }
}

export interface TypedPlaceholderOptions {
    /** Kept on screen throughout; only what follows it is typed and erased. */
    readonly prefix: string
    readonly endings: readonly string[]
    /**
     * Set false to freeze the animation — worth doing while the field has real
     * content, since the placeholder is not visible and every tick is a render.
     */
    readonly enabled: boolean
}

/**
 * Drives a placeholder that writes itself: it erases the tail of the sentence
 * one character at a time, then types the next variation in its place.
 *
 * Each step schedules exactly one timeout and each tick advances one character,
 * so there is no interval left running behind a paused or unmounted field.
 */
export function useTypedPlaceholder({ enabled, endings, prefix }: TypedPlaceholderOptions): string {
    const reducedMotion = useReducedMotion()
    const [state, setState] = useState<TypingState>(INITIAL)

    // A mode switch swaps the whole set of sentences; start the new one over
    // rather than typing it from wherever the previous one happened to be.
    useEffect(() => {
        setState(INITIAL)
    }, [endings])

    const ending = endings[state.endingIndex] ?? ''
    const animating = enabled && !reducedMotion && endings.length > 0

    useEffect(() => {
        if (!animating) {
            return
        }

        const timer = setTimeout(() => {
            setState((current) => advance(current, ending.length, endings.length))
        }, stepDelay(state.phase))

        return () => {
            clearTimeout(timer)
        }
    }, [animating, ending.length, endings.length, state])

    // Standing still — from reduced motion or a paused field — should still read
    // as a complete sentence rather than a half-typed one.
    return animating ? prefix + ending.slice(0, state.visibleCount) : prefix + ending
}
