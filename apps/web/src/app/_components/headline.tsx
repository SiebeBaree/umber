'use client'

import { type GenerationMode, MODELS_BY_MODE, type Model } from '@umber/ui/catalog'
import { Fragment, type ReactNode, useEffect, useEffectEvent, useRef, useState } from 'react'

import { listOf } from '../../lib/site'
import { ProviderMark } from './provider-mark'

/*
 * "Make an image with Nano Banana 2.1." Every few seconds the headline
 * picks another model at random, sometimes a video one, and the words that
 * change pop out and spring back in (see the `word` utility). It only picks
 * each lab's newest models, and only those whose name fits on one line at
 * the current width, so the headline never wraps and never moves the page
 * below it.
 */

const NOUN: Readonly<Record<GenerationMode, string>> = {
    image: 'an image',
    video: 'a video',
}

const HOLD_MS = 2600
// Long enough for the last word to finish leaving.
const LEAVE_MS = 360

/** Each lab's newest models: every one sharing its latest release date. */
function newest(models: readonly Model[]) {
    const latest = new Map<Model['provider'], string>()
    for (const model of models) {
        if (model.releasedOn > (latest.get(model.provider) ?? '')) {
            latest.set(model.provider, model.releasedOn)
        }
    }
    return models.filter((model) => model.releasedOn === latest.get(model.provider))
}

const POOL: Readonly<Record<GenerationMode, readonly Model[]>> = {
    image: newest(MODELS_BY_MODE.image),
    video: newest(MODELS_BY_MODE.video),
}

// Short enough to fit on the narrowest phones, before any measuring.
const FIRST: Line = {
    mode: 'image',
    model: POOL.image.find((m) => m.id === 'nano-banana-2-1') ?? POOL.image[0],
}

const MODEL_COUNT = MODELS_BY_MODE.image.length + MODELS_BY_MODE.video.length

// What screen readers and search engines get instead of the moving words.
const SPOKEN = `Make an image or a video with any of ${MODEL_COUNT} AI models, including ${listOf(['Nano Banana', 'GPT Image', 'Veo', 'Kling'])}.`

type Line = { readonly mode: GenerationMode; readonly model: Model }

/*
 * Runs as each noun mounts: its box eases to the new noun's width, so "Make"
 * and "with" glide instead of jumping. Kept in em, so it holds when the font
 * scales.
 */
function fitNoun(text: HTMLSpanElement | null) {
    const fit = () => {
        const box = text?.parentElement
        if (!text || !box) return
        const em = Number(getComputedStyle(text).fontSize.replace('px', ''))
        box.style.width = `${text.offsetWidth / em}em`
    }
    fit()
    document.fonts.ready.then(fit)
}

export function Headline() {
    const lineRef = useRef<HTMLSpanElement>(null)
    const probeRef = useRef<HTMLSpanElement>(null)
    const probeTextRef = useRef<HTMLSpanElement>(null)
    const [shown, setShown] = useState(FIRST)
    const [leaving, setLeaving] = useState<Line | null>(null)
    // Off until the first swap, so nothing animates on page load.
    const [lively, setLively] = useState(false)

    // Whether `model`'s line fits the headline's width without wrapping.
    const fits = (model: Model) => {
        if (!probeRef.current || !probeTextRef.current || !lineRef.current) {
            return false
        }
        probeTextRef.current.textContent = `${model.name}.`
        return probeRef.current.offsetWidth <= lineRef.current.clientWidth
    }

    const swap = useEffectEvent(() => {
        const line = lineRef.current
        if (
            !line ||
            leaving ||
            document.hidden ||
            // Scrolled away: the hero marks its copy inert.
            line.closest('[inert]') ||
            matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            return
        }
        const mode: GenerationMode = Math.random() < 0.5 ? 'image' : 'video'
        const options = POOL[mode].filter((m) => m.id !== shown.model.id)
        for (let tries = 0; tries < 8; tries++) {
            const model = options[Math.floor(Math.random() * options.length)]
            if (model && fits(model)) {
                setLively(true)
                setLeaving({ mode, model })
                return
            }
        }
    })

    useEffect(() => {
        const id = setInterval(swap, HOLD_MS + LEAVE_MS)
        return () => clearInterval(id)
    }, [])

    // Once the old words are gone, the new ones mount and spring in.
    useEffect(() => {
        if (!leaving) return
        const id = setTimeout(() => {
            setShown(leaving)
            setLeaving(null)
        }, LEAVE_MS)
        return () => clearTimeout(id)
    }, [leaving])

    return (
        <h1 className="display w-full text-[clamp(2rem,6.4vw+0.7rem,8rem)]">
            <span className="sr-only">{SPOKEN}</span>
            <span aria-hidden="true" className="block">
                <span className="block whitespace-nowrap">
                    Make{' '}
                    <span
                        className="inline-block whitespace-nowrap text-left text-accent transition-[width] duration-700 ease-(--spring)"
                        data-leaving={leaving && leaving.mode !== shown.mode ? '' : undefined}
                    >
                        <span className="inline-block" key={shown.mode} ref={fitNoun}>
                            <Words enter={lively} text={NOUN[shown.mode]} />
                        </span>
                    </span>{' '}
                    with
                </span>
                <span className="relative block whitespace-nowrap text-accent" ref={lineRef}>
                    <span
                        className="inline-flex items-center gap-[0.2em]"
                        data-leaving={leaving ? '' : undefined}
                        key={shown.model.id}
                    >
                        <Pop enter={lively} i={1}>
                            <ProviderMark
                                className="size-[0.78em] translate-y-[0.06em]"
                                provider={shown.model.provider}
                            />
                        </Pop>
                        <span>
                            <Words enter={lively} from={2} text={`${shown.model.name}.`} />
                        </span>
                    </span>
                    {/* Measures candidate models; see `fits`. */}
                    <span
                        className="invisible absolute top-0 left-0 inline-flex gap-[0.2em]"
                        ref={probeRef}
                    >
                        <span className="size-[0.78em]" />
                        <span ref={probeTextRef} />
                    </span>
                </span>
            </span>
        </h1>
    )
}

/** `text` as one `Pop` per word, numbered from `from` for the stagger. */
function Words({ text, from = 0, enter }: { text: string; from?: number; enter: boolean }) {
    return text.split(' ').map((word, i) => (
        <Fragment key={word}>
            {i > 0 && ' '}
            <Pop enter={enter} i={from + i}>
                {word}
            </Pop>
        </Fragment>
    ))
}

/**
 * One word that springs in if `enter` was on when it mounted, and pops out
 * when an ancestor has `data-leaving`. `i` sets its place in the stagger.
 */
function Pop({ i, enter, children }: { i: number; enter: boolean; children: ReactNode }) {
    const [entering] = useState(enter)
    return (
        <span className="word" data-enter={entering ? '' : undefined} style={{ '--i': i }}>
            {children}
        </span>
    )
}
