import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { useProfile } from '../profile/profile-context'
import { NameStep } from './name-step'
import { OnboardingBackdrop } from './onboarding-backdrop'
import { ProvidersIntroStep } from './providers-intro-step'
import { ProvidersSetupStep } from './providers-setup-step'

/**
 * The first run, from "Welcome" to the create page: a beat of type over the
 * rushing canvas, the name question, the providers pitch, then the key form,
 * and finally the whole screen bolting out of the way of the app.
 *
 * The flow is an overlay above the app rather than a route inside it, so the
 * router underneath never has to know first-run exists — the gate in `App`
 * mounts this whenever there is no profile, which is also what an erase does.
 *
 * The name is committed only at the end. Committing it at the name step would
 * mean a relaunch mid-flow skips the provider half entirely.
 */

type Step = 'welcome' | 'name' | 'providers' | 'setup'

/** How long the welcome word holds the screen, exit animation included. */
const WELCOME_MS = 2400

/*
 * Leaving, in two overlapping parts. The step content goes first and quickly,
 * then the whole surface — canvas, blobs and all — fades off the app.
 *
 * Fading the surface is what makes this a hand-over rather than a cut: the
 * overlay is an opaque canvas over a create page that is already painted and
 * already greeting the new name, so dissolving it *is* the app arriving. An
 * earlier version faded only the content and then unmounted the opaque layer,
 * which meant the app snapped in whole on a single frame.
 */
const CONTENT_EXIT_SECONDS = 0.32
const SURFACE_EXIT_DELAY = 0.12
const SURFACE_EXIT_SECONDS = 0.75

/** Unmounted once the surface is invisible, plus a frame or two of slack. */
const EXIT_MS = Math.round((SURFACE_EXIT_DELAY + SURFACE_EXIT_SECONDS) * 1000) + 60

/*
 * The rotating title's language — rise, fall, blur — so the first screens the
 * app ever shows already move the way the rest of it does.
 */
const STEP_TRANSITION: Transition = { duration: 0.6, ease: [0.22, 1, 0.36, 1] }

const ENTER = { y: 30, opacity: 0, filter: 'blur(10px)' }
const CENTRE = { y: 0, opacity: 1, filter: 'blur(0px)', transition: STEP_TRANSITION }
const EXIT = { y: -30, opacity: 0, filter: 'blur(10px)', transition: STEP_TRANSITION }

const SHOWN = { opacity: 1 }
const HIDDEN = { opacity: 0 }

const CONTENT_TRANSITION: Transition = { duration: CONTENT_EXIT_SECONDS, ease: 'easeOut' }
const SURFACE_TRANSITION: Transition = {
    duration: SURFACE_EXIT_SECONDS,
    delay: SURFACE_EXIT_DELAY,
    ease: [0.33, 0, 0.67, 1],
}

/** Keyed where it is used: `AnimatePresence` tracks its direct children. */
function StepFrame({ children }: { readonly children: ReactNode }) {
    return (
        <motion.div
            animate={CENTRE}
            className="flex w-full justify-center"
            exit={EXIT}
            initial={ENTER}
        >
            {children}
        </motion.div>
    )
}

export interface OnboardingFlowProps {
    /** Fired as the exit starts, for the app to make sure Create is beneath. */
    readonly onLeaving: () => void
    /** Fired once the exit has played out and the overlay can unmount. */
    readonly onDone: () => void
}

/** The welcome word's stay on screen, ended by the timer rather than a click. */
function useWelcomeTimer(step: Step, advance: () => void) {
    useEffect(() => {
        if (step !== 'welcome') {
            return
        }

        const timer = setTimeout(advance, WELCOME_MS)

        return () => {
            clearTimeout(timer)
        }
    }, [step, advance])
}

/**
 * The backstop for the unmount. The fade finishing is what normally ends the
 * flow — see `finished` below — because a timer racing an animation is exactly
 * how a hand-over turns back into a cut: whenever the fade runs behind its
 * schedule, the overlay is torn off part-way through and the app snaps in.
 *
 * This only covers the case where the animation never reports finishing at
 * all, such as a window left in the background for the whole exit, where
 * nothing is on screen to look harsh anyway.
 */
function useExitBackstop(exiting: boolean, onDone: () => void) {
    useEffect(() => {
        if (!exiting) {
            return
        }

        const timer = setTimeout(onDone, EXIT_MS + 600)

        return () => {
            clearTimeout(timer)
        }
    }, [exiting, onDone])
}

function useOnboardingFlow({ onDone, onLeaving }: OnboardingFlowProps) {
    const reducedMotion = useReducedMotion()
    const profile = useProfile()

    // With reduced motion the welcome beat is pure delay, so it is skipped.
    const [step, setStep] = useState<Step>(reducedMotion ? 'name' : 'welcome')
    const [name, setName] = useState('')
    const [exiting, setExiting] = useState(false)

    const openName = useCallback(() => {
        setStep('name')
    }, [])

    const submitName = useCallback((first: string) => {
        setName(first)
        setStep('providers')
    }, [])

    const openSetup = useCallback(() => {
        setStep('setup')
    }, [])

    const finish = useCallback(() => {
        profile.setName(name)
        onLeaving()

        if (reducedMotion) {
            onDone()
            return
        }

        setExiting(true)
    }, [profile, name, onLeaving, onDone, reducedMotion])

    // The surface reports its own fade landing, which is the moment there is
    // nothing left to see and the overlay can go.
    const finished = useCallback(() => {
        if (exiting) {
            onDone()
        }
    }, [exiting, onDone])

    useWelcomeTimer(step, openName)
    useExitBackstop(exiting, onDone)

    return { step, exiting, finished, submitName, openSetup, finish }
}

type FlowApi = ReturnType<typeof useOnboardingFlow>

function StepSwitch({ flow }: { readonly flow: FlowApi }) {
    return (
        <AnimatePresence mode="wait">
            {flow.step === 'welcome' ? (
                <StepFrame key="welcome">
                    <h1 className="text-center text-5xl font-semibold tracking-tight">Welcome</h1>
                </StepFrame>
            ) : flow.step === 'name' ? (
                <StepFrame key="name">
                    <NameStep onSubmit={flow.submitName} />
                </StepFrame>
            ) : flow.step === 'providers' ? (
                <StepFrame key="providers">
                    <ProvidersIntroStep onContinue={flow.openSetup} onSkip={flow.finish} />
                </StepFrame>
            ) : (
                <StepFrame key="setup">
                    <ProvidersSetupStep onFinish={flow.finish} />
                </StepFrame>
            )}
        </AnimatePresence>
    )
}

export function OnboardingFlow(props: OnboardingFlowProps) {
    const flow = useOnboardingFlow(props)

    return (
        /*
         * z-40: over everything the app renders in flow, under the dialog
         * layer at z-50 — not that onboarding opens any. No `app-region` of
         * its own: the app header's drag region beneath keeps the frameless
         * window movable by its usual strip, and every control here sits well
         * below it.
         */
        <motion.div
            animate={flow.exiting ? HIDDEN : SHOWN}
            className="bg-canvas fixed inset-0 z-40 overflow-hidden"
            initial={false}
            onAnimationComplete={flow.finished}
            transition={SURFACE_TRANSITION}
        >
            <OnboardingBackdrop exiting={flow.exiting} />

            <motion.div
                animate={flow.exiting ? HIDDEN : SHOWN}
                className="relative flex h-full flex-col items-center justify-center overflow-y-auto py-10"
                transition={CONTENT_TRANSITION}
            >
                <StepSwitch flow={flow} />
            </motion.div>
        </motion.div>
    )
}
