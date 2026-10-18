'use client'

import Image, { type StaticImageData } from 'next/image'
import { useEffect, useRef, useState } from 'react'

import type { ModelName } from '../../lib/catalog'
import { media, optimizedSrc } from './media'
import { ProviderMark } from './provider-mark'
import { useScrollFrame } from './scroll'

/*
 * Scroll to generate. The section is pinned while the visitor scrolls
 * through three generations: each prompt types itself into the composer,
 * gets sent, and the image develops on a canvas the way a diffusion model
 * works, out of coloured noise and coarse blocks into the finished picture.
 * Finished images drop into the gallery strip with a running total.
 *
 * The canvas only repaints when the develop step changes (ten steps per
 * image), never per frame.
 */

type Generation = {
    readonly image: StaticImageData
    readonly alt: string
    /** What was asked for, shortened to fit the composer. */
    readonly prompt: string
    /** The model that made the image, at 16:9, 2K and high quality. */
    readonly model: ModelName
    /** The app's estimate for one image at those settings. */
    readonly price: number
}

const GENERATIONS: readonly Generation[] = [
    {
        image: media.koiClouds,
        alt: 'An orange koi fish swimming through white clouds in a pale blue sky.',
        prompt: 'An orange koi fish swimming through soft white clouds, seen from above',
        model: 'GPT Image 2.5 Flare',
        price: 0.0603,
    },
    {
        image: media.greenhouse,
        alt: 'A glass greenhouse glowing warm on a frozen lake at blue hour.',
        prompt: 'A small glass greenhouse on a frozen lake at blue hour, warm light inside',
        model: 'GPT Image 2.5 Sunburst',
        price: 0.0603,
    },
    {
        image: media.rainWindow,
        alt: 'A rainy Tokyo side street at night seen through a café window.',
        prompt: 'A rainy Tokyo side street at night, seen through a café window',
        model: 'GPT Image 2.5 Flare',
        price: 0.0603,
    },
]

// Mosaic resolution per develop step, in columns. One step past the last
// is the finished image.
const LEVELS = [3, 5, 8, 13, 21, 34, 55, 89, 144] as const
const NOISE = [1, 0.85, 0.7, 0.55, 0.42, 0.3, 0.2, 0.12, 0.06] as const
const SHARP = LEVELS.length

// Where each beat falls within one generation's share of the scroll.
const TYPED_AT = 0.3
const DEVELOP_FROM = 0.36
const DEVELOP_TO = 0.84

type Frame = {
    /** The generation whose prompt is in the composer. */
    readonly typing: number
    readonly chars: number
    readonly busy: boolean
    /** The generation on the canvas, -1 before the first one. */
    readonly shown: number
    readonly level: number
    readonly saved: number
}

function frameAt(p: number): Frame {
    const n = GENERATIONS.length
    const slot = Math.min(Math.floor(p * n), n - 1)
    const t = p * n - slot
    const developing = t >= DEVELOP_FROM
    return {
        typing: slot,
        chars: Math.round(GENERATIONS[slot].prompt.length * Math.min(t / TYPED_AT, 1)),
        busy: t >= TYPED_AT && t < DEVELOP_TO,
        shown: developing ? slot : slot - 1,
        level: developing
            ? Math.min(
                  Math.floor(((t - DEVELOP_FROM) / (DEVELOP_TO - DEVELOP_FROM)) * (SHARP + 1)),
                  SHARP,
              )
            : SHARP,
        saved: t >= DEVELOP_TO ? slot + 1 : slot,
    }
}

function sameFrame(a: Frame, b: Frame) {
    return (
        a.typing === b.typing &&
        a.chars === b.chars &&
        a.busy === b.busy &&
        a.shown === b.shown &&
        a.level === b.level &&
        a.saved === b.saved
    )
}

const usd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
})

/* --------------------------------------------------------------- Canvas */

function scratch(width: number, height: number) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    return canvas
}

/*
 * Everything slow is made once and reused: three tiles of noise, and per
 * image a small averaged copy that every coarse step is cut from. A step
 * then costs three small draws.
 */
const NOISE_W = 384
const NOISE_H = 216
let noiseTiles: HTMLCanvasElement[] | undefined

function noiseTile(level: number) {
    noiseTiles ??= [0, 1, 2].map(() => {
        const canvas = scratch(NOISE_W, NOISE_H)
        const ctx = canvas.getContext('2d')
        if (!ctx) return canvas
        const data = ctx.createImageData(NOISE_W, NOISE_H)
        // Mostly brightness, with a little colour in it, so the static reads
        // as soft grain on the light page rather than a detuned television.
        for (let i = 0; i < data.data.length; i += 4) {
            const v = 120 + Math.random() * 135
            data.data[i] = v + (Math.random() - 0.5) * 70
            data.data[i + 1] = v + (Math.random() - 0.5) * 70
            data.data[i + 2] = v + 12 + (Math.random() - 0.5) * 70
            data.data[i + 3] = 255
        }
        ctx.putImageData(data, 0, 0)
        return canvas
    })
    return noiseTiles[level % noiseTiles.length]
}

// Averaging straight down to a handful of pixels samples badly, so every
// coarse step starts from this mid-size copy instead of the full image.
const averaged = new WeakMap<HTMLImageElement, HTMLCanvasElement>()

function averagedCopy(image: HTMLImageElement) {
    let copy = averaged.get(image)
    if (!copy) {
        copy = scratch(192, 108)
        const ctx = copy.getContext('2d')
        if (ctx) {
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(image, 0, 0, copy.width, copy.height)
        }
        averaged.set(image, copy)
    }
    return copy
}

/**
 * One develop step: the image at `LEVELS[level]` columns, blown up without
 * smoothing, under a veil of noise that thins out step by step.
 */
function paint(canvas: HTMLCanvasElement, image: HTMLImageElement | undefined, level: number) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    ctx.globalAlpha = 1
    ctx.clearRect(0, 0, width, height)
    if (!image?.complete || !image.naturalWidth) return

    if (level >= SHARP) {
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(image, 0, 0, width, height)
        return
    }

    const cols = LEVELS[level]
    const rows = Math.max(1, Math.round((cols * height) / width))
    const tiny = scratch(cols, rows)
    const tinyCtx = tiny.getContext('2d')
    if (!tinyCtx) return
    tinyCtx.imageSmoothingQuality = 'high'
    tinyCtx.drawImage(averagedCopy(image), 0, 0, cols, rows)

    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tiny, 0, 0, width, height)
    ctx.globalAlpha = NOISE[level]
    ctx.drawImage(noiseTile(level), 0, 0, width, height)
    ctx.globalAlpha = 1
}

/** What the canvas shows, so it only repaints when that changes. */
type CanvasState = { images: HTMLImageElement[]; shown: number; level: number }

function show(
    canvas: HTMLCanvasElement | null,
    state: CanvasState,
    shown: number,
    level: number,
    force = false,
) {
    if (!canvas) return
    if (!force && state.shown === shown && state.level === level) return
    state.shown = shown
    state.level = level
    paint(canvas, state.images[shown], level)
}

/* -------------------------------------------------------------- Section */

export function Develop() {
    const sectionRef = useRef<HTMLElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const canvasState = useRef<CanvasState>({ images: [], shown: -2, level: 0 })
    const [frame, setFrame] = useState(() => frameAt(0))

    useScrollFrame(sectionRef, (p) => {
        const next = frameAt(p)
        setFrame((prev) => (sameFrame(prev, next) ? prev : next))
        show(canvasRef.current, canvasState.current, next.shown, next.level)
    })

    // Fetch the three images, at the canvas's own size, once the section is
    // getting close, and keep the canvas backing store matched to its size on
    // screen.
    useEffect(() => {
        const section = sectionRef.current
        const canvas = canvasRef.current
        const state = canvasState.current
        if (!section || !canvas) return

        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const repaintCurrent = () => show(canvas, state, state.shown, state.level, true)

        const loader = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting) return
                loader.disconnect()
                state.images = GENERATIONS.map((g) => {
                    const img = new window.Image()
                    img.decoding = 'async'
                    img.addEventListener('load', repaintCurrent)
                    img.src = optimizedSrc(g.image, canvas.clientWidth * dpr)
                    return img
                })
            },
            { rootMargin: '150% 0px' },
        )
        loader.observe(section)

        const sizer = new ResizeObserver(() => {
            canvas.width = Math.round(canvas.clientWidth * dpr)
            canvas.height = Math.round(canvas.clientHeight * dpr)
            repaintCurrent()
        })
        sizer.observe(canvas)

        return () => {
            loader.disconnect()
            sizer.disconnect()
        }
    }, [])

    const current = GENERATIONS[frame.typing]
    const developing = frame.shown === frame.typing && frame.level < SHARP
    const spent = GENERATIONS.slice(0, frame.saved).reduce((sum, g) => sum + g.price, 0)
    return (
        <section className="relative h-[420svh]" data-theme="canvas" id="images" ref={sectionRef}>
            <div className="sticky top-0 flex h-svh items-center">
                <div className="mx-auto grid w-full max-w-[1400px] items-center gap-6 px-5 pt-14 sm:px-8 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
                    <div>
                        <h2 className="display text-[clamp(3.6rem,7.6vw,8.25rem)]">Images</h2>
                        <p className="mt-4 max-w-sm text-pretty text-dim max-lg:text-sm lg:mt-8 lg:text-lg">
                            Type what you want, see the price and send it. Every image lands in your
                            gallery with the prompt and model that made it.
                        </p>
                    </div>

                    <div className="text-ink">
                        {/* The result, framed like a finished image in the app. */}
                        <div className="relative aspect-video overflow-hidden rounded-2xl shadow-[0_16px_40px_-18px_rgb(28_41_90/0.35)] ring-1 ring-ink/10 ring-inset">
                            <div
                                aria-hidden="true"
                                className="glass absolute inset-0 rounded-2xl bg-[radial-gradient(70%_60%_at_50%_45%,rgb(255_255_255/0.9),transparent),radial-gradient(50%_50%_at_70%_70%,rgb(49_100_228/0.12),transparent)]"
                            />
                            <canvas
                                aria-label={
                                    frame.shown >= 0
                                        ? GENERATIONS[frame.shown].alt
                                        : 'An empty canvas'
                                }
                                className="absolute inset-0 size-full"
                                ref={canvasRef}
                                role="img"
                            />
                            {frame.shown >= 0 ? null : (
                                <p className="absolute inset-0 grid place-items-center text-sm text-muted">
                                    Scroll to generate
                                </p>
                            )}
                            <p
                                className={`absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[11px] font-medium shadow-[0_4px_12px_-4px_rgb(28_41_90/0.1)] transition-opacity duration-300 ${
                                    developing ? 'opacity-100' : 'opacity-0'
                                }`}
                            >
                                <span className="size-1.5 rounded-full bg-accent" />
                                Generating {Math.round((frame.level / SHARP) * 100)}%
                            </p>
                        </div>

                        {/* The composer, as in the app. */}
                        <div className="glass mt-4 rounded-[1.75rem] p-3">
                            <p className="min-h-[3.4em] px-2 pt-1 text-[15px] leading-relaxed">
                                {current.prompt.slice(0, frame.chars)}
                                <span
                                    aria-hidden="true"
                                    className="ml-px inline-block h-[1.1em] w-px translate-y-[0.2em] bg-accent"
                                />
                            </p>
                            <div className="mt-2 flex items-center gap-2 text-[13px] font-medium">
                                <span className="recessed flex h-9 items-center rounded-full p-0.5 max-sm:hidden">
                                    <span className="flex h-full items-center gap-1.5 rounded-full bg-surface px-3 shadow-[0_1px_2px_rgb(28_35_51/0.16),0_4px_12px_-4px_rgb(28_35_51/0.2)]">
                                        <Icon name="image" />
                                        Image
                                    </span>
                                    <span className="flex h-full items-center gap-1.5 px-3 text-muted">
                                        <Icon name="video" />
                                        Video
                                    </span>
                                </span>
                                <span className="glass-control flex h-9 min-w-0 items-center gap-2 rounded-full px-3">
                                    <ProviderMark className="size-4" provider="openai" />
                                    <span className="truncate">{current.model}</span>
                                </span>
                                <span className="glass-control flex h-9 items-center rounded-full px-3 max-md:hidden">
                                    16:9
                                </span>
                                <span className="glass-control flex h-9 items-center rounded-full px-3 max-md:hidden">
                                    2K
                                </span>
                                <span className="ml-auto text-muted tabular-nums">
                                    {usd.format(current.price)}
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={`grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-ink transition-[opacity,scale] duration-300 ${
                                        frame.busy ? 'scale-90 opacity-50' : ''
                                    }`}
                                >
                                    <Icon name="send" />
                                </span>
                            </div>
                        </div>

                        {/* The gallery filling up, and what it has cost so far. */}
                        <div className="mt-4 flex items-center justify-between gap-4 px-1">
                            <div className="flex gap-2">
                                {GENERATIONS.map((g, i) => (
                                    <div
                                        className="aspect-video w-14 overflow-hidden rounded-lg bg-white/40 shadow-[0_3px_12px_-4px_rgb(28_41_90/0.25)] sm:w-20"
                                        key={g.prompt}
                                    >
                                        <Image
                                            alt=""
                                            className={`size-full object-cover transition-[opacity,scale] duration-500 ${
                                                i < frame.saved
                                                    ? 'opacity-100'
                                                    : 'scale-110 opacity-0'
                                            }`}
                                            sizes="80px"
                                            src={g.image}
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-right text-xs text-muted">
                                Saved to your gallery
                                <br />
                                <span className="font-medium text-ink tabular-nums">
                                    {usd.format(spent)} spent
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

// Lucide's image, clapperboard and arrow-up glyphs, as in the app.
const ICONS = {
    image: (
        <>
            <rect height="18" rx="2" width="18" x="3" y="3" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </>
    ),
    video: (
        <>
            <path d="M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" />
            <path d="m6.2 5.3 3.1 3.9" />
            <path d="m12.4 3.4 3.1 4" />
            <path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </>
    ),
    send: (
        <>
            <path d="m5 12 7-7 7 7" />
            <path d="M12 19V5" />
        </>
    ),
}

function Icon({ name }: { name: keyof typeof ICONS }) {
    return (
        <svg
            aria-hidden="true"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
        >
            {ICONS[name]}
        </svg>
    )
}
