import { ProviderMark } from './provider-mark'

/*
 * The Umber create screen, drawn in HTML instead of shown as a screenshot,
 * so it stays sharp at any size and on any screen. It copies the app's
 * layout and styles (packages/ui/src/features/create) and its lucide icons.
 *
 * Everything is sized in `cqw`, a percentage of the window's own width, so
 * the whole window scales as one picture.
 */

// Lucide paths, copied from the app's lucide-react.
const ICONS = {
    wand: [
        'm21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72',
        'm14 7 3 3',
        'M5 6v4',
        'M19 14v4',
        'M10 2v2',
        'M7 8H3',
        'M21 16h-4',
        'M11 3H9',
    ],
    gallery: [
        'm22 11-1.296-1.296a2.4 2.4 0 0 0-3.408 0L11 16',
        'M4 8a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2',
        'M10 2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z',
    ],
    settings: [
        'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915',
        'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    ],
    plus: ['M5 12h14', 'M12 5v14'],
    minus: ['M5 12h14'],
    image: [
        'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z',
        'M11 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
        'm21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21',
    ],
    video: [
        'm12.296 3.464 3.02 3.956',
        'M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3z',
        'M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
        'm6.18 5.276 3.1 3.899',
    ],
    square: ['M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z'],
    sliders: [
        'M10 5H3',
        'M12 19H3',
        'M14 3v4',
        'M16 17v4',
        'M21 12h-9',
        'M21 19h-5',
        'M21 5h-7',
        'M8 10v4',
        'M8 12H3',
    ],
    chevron: ['m6 9 6 6 6-6'],
    send: ['m5 12 7-7 7 7', 'M12 19V5'],
} as const

function Icon({ name, className }: { name: keyof typeof ICONS; className: string }) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
        >
            {ICONS[name].map((d) => (
                <path d={d} key={d} />
            ))}
        </svg>
    )
}

/** A glass chip from the composer's control row. */
function Chip({ children }: { children: React.ReactNode }) {
    return (
        <span className="glass-control flex h-[3.3cqw] items-center gap-[0.7cqw] rounded-full px-[1.1cqw]">
            {children}
        </span>
    )
}

export function AppWindow({ className }: { className?: string }) {
    return (
        <div className={`@container ${className ?? ''}`}>
            <figure
                aria-label="The Umber create screen: a prompt about an astronaut crossing red dunes, Grok Imagine Image 2.0 picked as the model, 1:1 at 1K, and the price, $0.04, shown before anything is sent."
                className="relative aspect-[1081/760] overflow-hidden rounded-[1.3cqw] bg-canvas text-ink shadow-[0_50px_120px_-40px_rgb(16_24_60/0.55),0_0_0_1px_rgb(28_35_51/0.25)]"
                role="img"
            >
                <div aria-hidden="true" className="backdrop-glow absolute inset-0">
                    <div className="grain absolute inset-0 opacity-60" />
                </div>

                {/* The title bar and header. */}
                <div className="relative flex h-[7.2cqw] items-center px-[2.3cqw]">
                    <span className="flex gap-[0.85cqw]">
                        <span className="size-[1.15cqw] rounded-full bg-[#ff5f57]" />
                        <span className="size-[1.15cqw] rounded-full bg-[#febc2e]" />
                        <span className="size-[1.15cqw] rounded-full bg-[#28c840]" />
                    </span>
                    <span className="ml-[2.2cqw] flex items-center gap-[0.8cqw] text-[1.3cqw] font-semibold">
                        <svg aria-hidden="true" className="size-[2.2cqw]" viewBox="0 0 64 64">
                            <defs>
                                <linearGradient
                                    id="app-window-ring"
                                    x1="0.1"
                                    x2="0.85"
                                    y1="1"
                                    y2="0"
                                >
                                    <stop offset="0" stopColor="#E8A24C" />
                                    <stop offset="0.55" stopColor="#9A5B2C" />
                                    <stop offset="1" stopColor="#3A2419" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M7 32a25 25 0 1 1 50 0 25 25 0 1 1-50 0ZM18.5 29a16.5 16.5 0 1 1 33 0 16.5 16.5 0 1 1-33 0Z"
                                fill="url(#app-window-ring)"
                                fillRule="evenodd"
                            />
                        </svg>
                        Umber
                    </span>

                    <span className="glass-raised absolute top-1/2 left-1/2 flex h-[4.1cqw] -translate-x-1/2 -translate-y-1/2 items-center rounded-full p-[0.35cqw] text-[1.3cqw] font-medium">
                        <span className="flex h-full items-center gap-[0.6cqw] rounded-full bg-surface px-[1.4cqw] shadow-[0_1px_2px_rgb(28_35_51/0.16),0_4px_12px_-4px_rgb(28_35_51/0.2)]">
                            <Icon className="size-[1.5cqw]" name="wand" />
                            Create
                        </span>
                        <span className="flex h-full items-center gap-[0.6cqw] px-[1.4cqw] text-ink/60">
                            <Icon className="size-[1.5cqw]" name="gallery" />
                            Gallery
                        </span>
                    </span>

                    <span className="glass-control absolute top-1/2 right-[2.3cqw] grid size-[3.7cqw] -translate-y-1/2 place-items-center rounded-full">
                        <Icon className="size-[1.65cqw]" name="settings" />
                    </span>
                </div>

                <p className="relative mt-[18.6cqw] text-center text-[3.4cqw] font-semibold tracking-[-0.025em]">
                    What will you create today?
                </p>

                {/* The composer. */}
                <div className="glass relative mx-auto mt-[4.1cqw] w-[88.7cqw] rounded-[2.6cqw] p-[1.15cqw]">
                    <p className="flex items-center gap-[1.2cqw] px-[0.6cqw] pt-[0.4cqw] text-[1.42cqw] text-muted">
                        <Icon className="size-[1.6cqw]" name="plus" />A cinematic photo of an
                        astronaut crossing red dunes
                    </p>
                    <div className="mt-[1.5cqw] flex items-center gap-[0.75cqw] text-[1.2cqw] font-medium">
                        <span className="recessed flex h-[3.3cqw] items-center rounded-full p-[0.25cqw]">
                            <span className="flex h-full items-center gap-[0.55cqw] rounded-full bg-surface px-[1.05cqw] shadow-[0_1px_2px_rgb(28_35_51/0.16),0_4px_12px_-4px_rgb(28_35_51/0.2)]">
                                <Icon className="size-[1.4cqw]" name="image" />
                                Image
                            </span>
                            <span className="flex h-full items-center gap-[0.55cqw] px-[1.05cqw] text-ink/60">
                                <Icon className="size-[1.4cqw]" name="video" />
                                Video
                            </span>
                        </span>
                        <Chip>
                            <ProviderMark className="size-[1.4cqw]" provider="xai" />
                            Grok Imagine Image 2.0
                            <Icon className="size-[1.2cqw] text-ink/60" name="chevron" />
                        </Chip>
                        <Chip>
                            <Icon className="size-[1.4cqw]" name="square" />
                            1:1
                            <Icon className="size-[1.2cqw] text-ink/60" name="chevron" />
                        </Chip>
                        <Chip>
                            <Icon className="size-[1.4cqw]" name="sliders" />
                            1K
                            <Icon className="size-[1.2cqw] text-ink/60" name="chevron" />
                        </Chip>
                        <Chip>
                            <Icon className="size-[1.4cqw]" name="gallery" />
                            <Icon className="size-[1.2cqw] text-ink/40" name="minus" />1
                            <Icon className="size-[1.2cqw] text-ink/60" name="plus" />
                        </Chip>
                        <span className="ml-auto text-muted tabular-nums">$0.04</span>
                        <span className="grid size-[3.3cqw] place-items-center rounded-full bg-accent/50 text-accent-ink">
                            <Icon className="size-[1.4cqw]" name="send" />
                        </span>
                    </div>
                </div>
            </figure>
        </div>
    )
}
