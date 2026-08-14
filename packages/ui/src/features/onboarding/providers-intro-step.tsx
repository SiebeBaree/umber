import { UMBER_MARK } from '@umber/brand'
import { motion, type Transition } from 'motion/react'
import { useMemo, type CSSProperties } from 'react'

import { Button } from '../../components/ui/button'
import { ProviderMark } from '../create/catalog'
import type { KeyProviderId } from '../settings/key-providers'

/**
 * The pitch before the paperwork: Umber's own mark at the centre with every
 * provider it can call in an even ring around it — the app in the middle,
 * reaching out to all of them — and the bring-your-own-keys model in one
 * sentence. The next step is the actual key form, so this one only has to
 * make the idea legible, and skippable.
 */

/** Around the ring clockwise from the top, in the key list's own order. */
const RING_PROVIDERS: readonly KeyProviderId[] = [
    'google',
    'openai',
    'blackForestLabs',
    'ideogram',
    'recraft',
    'runway',
    'kuaishou',
    'bytedance',
    'alibaba',
]

/** Centre-to-chip distance, in rem; the container is sized to just contain it. */
const RING_RADIUS = 7.5

/*
 * Chip positions, computed once: nine points evenly spaced on the circle,
 * starting straight up, so the figure is symmetrical from every seat. Each
 * style lands the chip's centre on its point; the motion wrapper inside is
 * what animates, so entrance transforms never fight the positioning ones.
 */
const RING: readonly { readonly id: KeyProviderId; readonly style: CSSProperties }[] =
    RING_PROVIDERS.map((id, index) => {
        const angle = ((index / RING_PROVIDERS.length) * 360 - 90) * (Math.PI / 180)

        return {
            id,
            style: {
                left: `calc(50% + ${(RING_RADIUS * Math.cos(angle)).toFixed(3)}rem)`,
                top: `calc(50% + ${(RING_RADIUS * Math.sin(angle)).toFixed(3)}rem)`,
            },
        }
    })

const CHIP_TRANSITION: Transition = { duration: 0.5, ease: [0.22, 1, 0.36, 1] }

const CHIP_ENTER = { opacity: 0, scale: 0.7 }
const CHIP_SETTLED = { opacity: 1, scale: 1 }

/** The centre arrives first; the ring pours in clockwise behind it. */
const RING_STAGGER_START = 0.15

function RingChip({
    index,
    provider,
}: {
    readonly provider: KeyProviderId
    readonly index: number
}) {
    const transition = useMemo<Transition>(
        () => ({ ...CHIP_TRANSITION, delay: RING_STAGGER_START + 0.05 * index }),
        [index],
    )

    return (
        <motion.div
            animate={CHIP_SETTLED}
            className="glass-raised flex size-14 items-center justify-center rounded-full"
            initial={CHIP_ENTER}
            transition={transition}
        >
            <ProviderMark className="size-6 text-ink/70" provider={provider} />
        </motion.div>
    )
}

function ProviderRing() {
    return (
        <div aria-hidden className="relative size-[19rem]">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <motion.div
                    animate={CHIP_SETTLED}
                    className="glass-raised flex size-24 items-center justify-center rounded-full"
                    initial={CHIP_ENTER}
                    transition={CHIP_TRANSITION}
                >
                    <img alt="" className="size-12" src={UMBER_MARK} />
                </motion.div>
            </div>

            {RING.map(({ id, style }, index) => (
                <div className="absolute -translate-x-1/2 -translate-y-1/2" key={id} style={style}>
                    <RingChip index={index} provider={id} />
                </div>
            ))}
        </div>
    )
}

export interface ProvidersIntroStepProps {
    readonly onContinue: () => void
    readonly onSkip: () => void
}

export function ProvidersIntroStep({ onContinue, onSkip }: ProvidersIntroStepProps) {
    return (
        <div className="flex w-full max-w-md flex-col items-center px-6">
            <ProviderRing />

            <h1 className="mt-8 text-center text-4xl font-semibold tracking-tight text-balance">
                Bring your own keys
            </h1>
            <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-muted">
                Umber calls each AI provider directly with an API key you own. Keys stay on this
                device and the provider bills you for exactly what you generate.
            </p>

            <Button className="mt-8 w-full max-w-xs" onClick={onContinue}>
                Connect a provider
            </Button>
            <Button className="mt-2" onClick={onSkip} size="sm" variant="ghost">
                Skip for now
            </Button>
        </div>
    )
}
