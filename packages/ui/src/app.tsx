import { useCallback, useState } from 'react'

import { Button } from './components/button'
import { Greeting } from './components/greeting'
import type { Platform } from './platform'

export interface AppProps {
    /** Which shell is hosting the UI. Only affects labelling. */
    readonly platform: Platform
    /**
     * A short line describing the host runtime, rendered in the footer. The shells
     * fill this in with whatever they happen to know about themselves.
     */
    readonly runtime?: string | undefined
}

/**
 * The entire Umber application. Both `@umber/web` and `@umber/desktop` mount
 * this component and nothing else — that is what keeps the two shells identical.
 */
export function App({ platform, runtime }: AppProps) {
    const [count, setCount] = useState(0)

    const increment = useCallback(() => {
        setCount((current) => current + 1)
    }, [])

    const reset = useCallback(() => {
        setCount(0)
    }, [])

    return (
        <main
            className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-12 text-center"
            data-platform={platform}
        >
            <Greeting platform={platform} />

            <section className="flex w-full max-w-sm flex-col items-center gap-5 rounded-xl border border-line bg-surface p-7">
                {/* <output> carries an implicit role="status", so the count is announced. */}
                <output className="tabular-nums">
                    Clicked {count} {count === 1 ? 'time' : 'times'}
                </output>

                <div className="flex flex-wrap justify-center gap-3">
                    <Button onClick={increment}>Click me</Button>
                    <Button disabled={count === 0} onClick={reset} variant="secondary">
                        Reset
                    </Button>
                </div>
            </section>

            {runtime === undefined ? null : (
                <footer className="text-xs text-muted">{runtime}</footer>
            )}
        </main>
    )
}
