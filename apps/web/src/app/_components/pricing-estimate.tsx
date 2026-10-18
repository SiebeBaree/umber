'use client'

import { type ReactNode, useState } from 'react'

import { DownloadButton } from './buttons'
import { Logo } from './logo'

/*
 * A month of images and videos, priced on Umber and on the credit
 * subscriptions people weigh it against. Umber's figure is the labs' own
 * price. A subscription costs its cheapest plan that covers the month,
 * whatever is left unused. Plans and credit costs as published in
 * October 2026.
 */

type Month = { images: number; videos: number }

type Plan = {
    name: string
    price: number
    allowance: number
    /** False where the plan can't run the video model at all. */
    video: boolean
}

type Subscription = {
    name: string
    unit: 'credits' | 'units'
    /** What one image and one video take out of the allowance. */
    cost: { image: number; video: number }
    /** Cheapest first. */
    plans: readonly [Plan, ...Plan[]]
    privacy: string
}

const SUBSCRIPTIONS: readonly Subscription[] = [
    {
        // Krea only prices Veo 3.1 at 720p without sound, so its video cost is
        // that clip's, which flatters Krea.
        name: 'Krea',
        unit: 'units',
        cost: { image: 127, video: 1212 },
        plans: [
            { name: 'Basic', price: 9, allowance: 5_000, video: false },
            { name: 'Pro', price: 35, allowance: 20_000, video: true },
            { name: 'Max', price: 70, allowance: 40_000, video: true },
            { name: 'Max', price: 105, allowance: 60_000, video: true },
        ],
        privacy: 'Images kept in their cloud',
    },
    {
        name: 'Higgsfield',
        unit: 'credits',
        cost: { image: 5.5, video: 80 },
        plans: [
            { name: 'Starter', price: 19, allowance: 270, video: false },
            { name: 'Plus', price: 59, allowance: 1_200, video: true },
            { name: 'Ultra', price: 129, allowance: 3_000, video: true },
        ],
        privacy: 'May train on your work',
    },
]

/** How far each stepper moves per click, and how far it goes. */
const STEPPERS = [
    { key: 'images', label: 'Images', step: 5, max: 500 },
    { key: 'videos', label: 'Videos', step: 1, max: 50 },
] as const satisfies readonly {
    key: keyof Month
    label: string
    step: number
    max: number
}[]

const UMBER_POINTS = [
    'No subscription',
    'No markup on lab prices',
    'No login',
    'Keys and images stay on your computer',
    'Desktop app for Mac, Windows and Linux',
    'Open source',
]

const usd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
})
const wholeUsd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
})
const count = new Intl.NumberFormat('en-US')

/** The cheapest plan that covers `month`, or the biggest when none does. */
function planFor(subscription: Subscription, month: Month) {
    const { cost, plans } = subscription
    const used = month.images * cost.image + month.videos * cost.video
    const fit = plans.find((plan) => used <= plan.allowance && (plan.video || month.videos === 0))
    return { plan: fit ?? plans.at(-1) ?? plans[0], used, fits: Boolean(fit) }
}

/** How a subscription's month compares with Umber's. */
function versus(price: number, umber: number) {
    if (umber === 0) return 'Umber costs nothing here'
    const ratio = price / umber
    if (ratio >= 1.15) return `${ratio.toFixed(1)}× what Umber costs`
    if (ratio > 0.87) return 'About what Umber costs'
    return `${Math.round((1 - ratio) * 100)}% less than Umber`
}

/**
 * The steppers and the cards. `imagePrice` and `videoPrice` are the labs'
 * prices for one image and one video; `children` is the section's intro,
 * shown beside the steppers.
 */
export function PricingEstimate({
    imagePrice,
    videoPrice,
    children,
}: {
    imagePrice: number
    videoPrice: number
    children: ReactNode
}) {
    const [month, setMonth] = useState<Month>({ images: 20, videos: 5 })
    const openai = month.images * imagePrice
    const google = month.videos * videoPrice
    const umber = openai + google

    return (
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-8">
                <div>{children}</div>
                <div className="glass-raised flex flex-wrap gap-1 rounded-[1.6rem] p-1.5">
                    {STEPPERS.map(({ key, label, step, max }) => (
                        <Stepper
                            key={key}
                            label={label}
                            max={max}
                            onStep={(direction) =>
                                setMonth((current) => ({
                                    ...current,
                                    [key]: Math.min(
                                        max,
                                        Math.max(0, current[key] + direction * step),
                                    ),
                                }))
                            }
                            value={month[key]}
                        />
                    ))}
                </div>
            </div>

            <div className="mt-14 grid gap-4 sm:mt-20 lg:grid-cols-3">
                <Card
                    featured
                    points={UMBER_POINTS.map((text) => ({ ok: true, text }))}
                    tag="Free"
                    title={<Logo className="h-6 w-auto" id="pricing" />}
                >
                    <p className="text-sm text-muted">You pay the labs directly.</p>
                    <Price amount={usd.format(umber)} />
                    <p className="mt-2 text-[13px] text-muted">
                        $0 to Umber. {usd.format(openai)} to OpenAI and {usd.format(google)} to
                        Google.
                    </p>
                    <div className="mt-auto grid pt-4">
                        <DownloadButton />
                    </div>
                </Card>

                {SUBSCRIPTIONS.map((subscription) => {
                    const { plan, used, fits } = planFor(subscription, month)
                    const { unit } = subscription
                    const markup =
                        ((plan.price / plan.allowance) * subscription.cost.image) / imagePrice
                    return (
                        <Card
                            key={subscription.name}
                            points={[
                                `Monthly plan, ${unit} reset`,
                                `${markup.toFixed(1)}× the lab price per image`,
                                'Account required',
                                subscription.privacy,
                                'No desktop app',
                                'Closed source',
                            ].map((text) => ({ ok: false, text }))}
                            tag={fits ? `${plan.name} plan` : `Over ${plan.name}`}
                            title={subscription.name}
                        >
                            <p className="text-sm text-muted">A monthly plan with {unit}.</p>
                            <Price amount={`${wholeUsd.format(plan.price)}${fits ? '' : '+'}`} />
                            <p className="mt-2 text-[13px] text-muted">
                                {fits
                                    ? `${count.format(Math.floor(plan.allowance - used))} of ${count.format(plan.allowance)} ${unit} go unused.`
                                    : `More than the ${plan.name} plan holds.`}
                            </p>
                            <p className="mt-auto pt-4 text-sm font-medium">
                                {versus(plan.price, umber)}
                            </p>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}

/**
 * A plan card: a header, a white panel with the price and a list of points.
 * Cards share their grid's three rows, so the panels and lists line up.
 */
function Card({
    title,
    tag,
    featured = false,
    points,
    children,
}: {
    title: ReactNode
    tag: string
    featured?: boolean
    points: readonly { ok: boolean; text: string }[]
    children: ReactNode
}) {
    return (
        <article
            className={`relative row-span-3 grid grid-rows-subgrid gap-y-0 overflow-hidden rounded-[1.75rem] p-1.5 ${
                featured
                    ? 'border border-white bg-white/80 shadow-[0_40px_70px_-30px_rgb(28_41_90/0.45),0_2px_10px_-6px_rgb(28_41_90/0.2)]'
                    : 'glass'
            }`}
        >
            {featured && (
                <div
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(120%_140%_at_100%_0%,#8fb0ff_0%,var(--color-accent)_45%,var(--color-accent-strong)_100%)]"
                />
            )}
            <header
                className={`relative flex items-center justify-between gap-4 px-3.5 pt-3 pb-4 text-lg font-semibold ${
                    featured ? 'text-accent-ink' : ''
                }`}
            >
                <h3>{title}</h3>
                <span
                    className={`text-sm font-medium ${featured ? 'text-accent-ink/85' : 'text-muted'}`}
                >
                    {tag}
                </span>
            </header>
            <div className="relative flex flex-col rounded-[1.4rem] bg-surface p-5 shadow-[0_14px_30px_-18px_rgb(28_41_90/0.28)]">
                {children}
            </div>
            <ul className="grid content-start gap-2.5 px-3.5 pt-5 pb-3 text-sm">
                {points.map((point) => (
                    <li className={`flex gap-2.5 ${point.ok ? '' : 'text-muted'}`} key={point.text}>
                        <svg
                            aria-label={point.ok ? 'Yes' : 'No'}
                            className={`mt-0.5 size-4 flex-none ${point.ok ? 'text-accent' : ''}`}
                            fill="none"
                            role="img"
                            viewBox="0 0 16 16"
                        >
                            <path
                                d={point.ok ? 'M3.5 8.5l3 3 6-7' : 'M4.5 4.5l7 7m0-7l-7 7'}
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.6"
                            />
                        </svg>
                        {point.text}
                    </li>
                ))}
            </ul>
        </article>
    )
}

function Price({ amount }: { amount: string }) {
    return (
        <p className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-[clamp(2.5rem,3.6vw,3.4rem)] leading-none font-medium tracking-[-0.035em] tabular-nums">
                {amount}
            </span>
            <span className="text-sm text-muted">/month</span>
        </p>
    )
}

/** A count with buttons either side. `onStep` gets -1 or 1. */
function Stepper({
    label,
    value,
    max,
    onStep,
}: {
    label: string
    value: number
    max: number
    onStep: (direction: -1 | 1) => void
}) {
    const noun = label.toLowerCase()
    return (
        <div className="flex items-center gap-1.5 py-1 pr-1 pl-4">
            <span className="mr-1.5 text-sm font-medium">{label}</span>
            <StepButton
                disabled={value <= 0}
                label={`Fewer ${noun}`}
                onClick={() => onStep(-1)}
                path="M4 8h8"
            />
            <output
                aria-label={`${label} a month`}
                className="min-w-[2.6ch] text-center text-[17px] font-semibold tabular-nums"
            >
                {value}
            </output>
            <StepButton
                disabled={value >= max}
                label={`More ${noun}`}
                onClick={() => onStep(1)}
                path="M4 8h8M8 4v8"
            />
        </div>
    )
}

function StepButton({
    label,
    path,
    disabled,
    onClick,
}: {
    label: string
    path: string
    disabled: boolean
    onClick: () => void
}) {
    return (
        <button
            aria-label={label}
            className="grid size-8 place-items-center rounded-full border border-white/80 bg-white/85 shadow-[0_2px_8px_-4px_rgb(28_41_90/0.2)] transition-[background-color,scale] duration-150 hover:bg-white active:scale-95 disabled:opacity-40"
            disabled={disabled}
            onClick={onClick}
            type="button"
        >
            <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
                <path d={path} stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
            </svg>
        </button>
    )
}
