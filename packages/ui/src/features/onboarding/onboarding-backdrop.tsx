import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, type RefObject } from 'react'

/**
 * The onboarding's own weather: the same three blobs as the app's canvas, but
 * brighter against the blue and driven by script rather than by CSS keyframes,
 * because their speed has to change while they move — a rush as the app opens,
 * a cruise through the steps, and a bolt off-screen at the end. CSS animations
 * cannot retime mid-flight without jumping, so each frame advances a virtual
 * clock instead and the speed only scales how fast that clock runs.
 */

/** How long the opening rush lasts before the drift settles into its cruise. */
const RUSH_SECONDS = 1.2

/*
 * Multiples of the pace a speed of 1 would give, which is tuned to roughly
 * match the app's own backdrop. The cruise stays a touch quicker than the app,
 * so the first-run canvas feels more awake than the one it hands over to.
 */
const RUSH_SPEED = 26
const CRUISE_SPEED = 4
const EXIT_SPEED = 7

/** Seconds for the speed to close most of the gap to its target. */
const SPEED_EASE = 0.45

/**
 * How long the blobs take to drift out on the way to the app. Longer than the
 * overlay's own fade, so they are still easing outwards as the app takes over
 * rather than arriving somewhere and stopping in view.
 */
const EXIT_SECONDS = 1.2

interface BlobPath {
    /** Size, resting position, colour and blur — motion never touches these. */
    readonly className: string
    /** Amplitudes (percent of own size) and angular speeds of the wander. */
    readonly ax: number
    readonly ay: number
    readonly fx: number
    readonly fy: number
    readonly px: number
    readonly py: number
    /** The slow breathing of the scale. */
    readonly sAmp: number
    readonly fs: number
    readonly ps: number
    /** Where the blob flees to on exit, in percent of its own size. */
    readonly exitX: number
    readonly exitY: number
}

/*
 * Brighter whites than the app's 85/70/55 and a slightly tighter blur: the
 * harsher step between blob and canvas is what marks this screen as somewhere
 * other than the app. No two frequencies match, so the drift never loops
 * visibly — the same trick the CSS keyframes play with their durations.
 */
const BLOBS: readonly BlobPath[] = [
    {
        className: '-top-[14%] -left-[6%] size-[30rem] bg-white/95 blur-[70px]',
        ax: 20,
        ay: 10,
        fx: 0.13,
        fy: 0.17,
        px: 0.4,
        py: 2.1,
        sAmp: 0.09,
        fs: 0.11,
        ps: 1.3,
        exitX: -62,
        exitY: -48,
    },
    {
        className: '-right-[8%] -bottom-[16%] size-[34rem] bg-white/85 blur-[80px]',
        ax: 17,
        ay: 9,
        fx: 0.1,
        fy: 0.15,
        px: 3.6,
        py: 0.9,
        sAmp: 0.11,
        fs: 0.09,
        ps: 4.2,
        exitX: 60,
        exitY: 52,
    },
    {
        className: 'top-[34%] left-[42%] size-[24rem] bg-white/70 blur-[64px]',
        ax: 23,
        ay: 13,
        fx: 0.16,
        fy: 0.12,
        px: 5.1,
        py: 3.3,
        sAmp: 0.1,
        fs: 0.14,
        ps: 2.6,
        exitX: 38,
        exitY: 64,
    },
]

interface DriftClock {
    t: number
    speed: number
    elapsed: number
    exitElapsed: number
}

/** One frame's bookkeeping; returns the eased 0–1 progress of the exit bolt. */
function advanceClock(state: DriftClock, dt: number, exiting: boolean): number {
    state.elapsed += dt

    const target = exiting ? EXIT_SPEED : state.elapsed < RUSH_SECONDS ? RUSH_SPEED : CRUISE_SPEED
    state.speed += (target - state.speed) * Math.min(1, dt / SPEED_EASE)
    state.t += dt * state.speed

    if (exiting) {
        state.exitElapsed += dt
    }

    /*
     * Smoothstepped rather than squared: a squared curve is still accelerating
     * hard when the overlay hands over, and the app arriving underneath a
     * lurch is what made the handover read as a cut. This leans out, then
     * eases off, so the drift is at its calmest exactly as the app appears.
     */
    const p = Math.min(state.exitElapsed / EXIT_SECONDS, 1)

    return p * p * (3 - 2 * p)
}

function transformAt(blob: BlobPath, t: number, flee: number): string {
    const x = blob.ax * Math.sin(blob.fx * t + blob.px) + blob.exitX * flee
    const y = blob.ay * Math.sin(blob.fy * t + blob.py) + blob.exitY * flee
    const scale = 1 + blob.sAmp * Math.sin(blob.fs * t + blob.ps) + 0.12 * flee

    return `translate3d(${x}%, ${y}%, 0) scale(${scale})`
}

type BlobTargets = RefObject<(HTMLDivElement | null)[]>

function useDrift(exiting: boolean): BlobTargets {
    const targets = useRef<(HTMLDivElement | null)[]>([])
    const reducedMotion = useReducedMotion()

    // The clock survives the effect restarting when `exiting` flips, so the
    // flee continues from wherever the drift happens to be.
    const clock = useRef<DriftClock>({ t: 0, speed: RUSH_SPEED, elapsed: 0, exitElapsed: 0 })

    useEffect(() => {
        if (reducedMotion === true) {
            return
        }

        let frame = 0
        let last = performance.now()

        const step = (now: number) => {
            // Capped so a backgrounded window resumes calmly, not with a lurch.
            const dt = Math.min((now - last) / 1000, 0.1)
            last = now

            const flee = advanceClock(clock.current, dt, exiting)

            for (const [index, blob] of BLOBS.entries()) {
                const element = targets.current[index]

                if (element !== null && element !== undefined) {
                    element.style.transform = transformAt(blob, clock.current.t, flee)
                }
            }

            frame = requestAnimationFrame(step)
        }

        frame = requestAnimationFrame(step)

        return () => {
            cancelAnimationFrame(frame)
        }
    }, [reducedMotion, exiting])

    return targets
}

interface DriftBlobProps {
    readonly blob: BlobPath
    readonly index: number
    readonly targets: BlobTargets
}

function DriftBlob({ blob, index, targets }: DriftBlobProps) {
    const setRef = useCallback(
        (element: HTMLDivElement | null) => {
            targets.current[index] = element
        },
        [targets, index],
    )

    return <div className={`absolute rounded-full ${blob.className}`} ref={setRef} />
}

export interface OnboardingBackdropProps {
    readonly exiting: boolean
}

export function OnboardingBackdrop({ exiting }: OnboardingBackdropProps) {
    const targets = useDrift(exiting)

    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {BLOBS.map((blob, index) => (
                <DriftBlob blob={blob} index={index} key={blob.className} targets={targets} />
            ))}

            <div className="film-grain absolute inset-0 opacity-70" />
        </div>
    )
}
