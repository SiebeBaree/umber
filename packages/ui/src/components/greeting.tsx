import { platformLabel, type Platform } from '../platform'

export interface GreetingProps {
    readonly platform: Platform
}

/** The headline block. Identical on every platform apart from the label. */
export function Greeting({ platform }: GreetingProps) {
    return (
        <header className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">Umber</p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Hello, world!</h1>
            <p className="text-muted">
                This screen is shared code, running on {platformLabel(platform)}.
            </p>
        </header>
    )
}
