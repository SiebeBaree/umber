import { useRouteContext } from '@tanstack/react-router'
import { ArrowDownToLine, Sparkles } from 'lucide-react'

import { Button } from '../../components/ui/button'
import { useUpdates } from '../updates/updates-context'

/**
 * The new-version notice. Renders nothing at all until there is something to
 * say, which is why it can sit unconditionally at the top of the page.
 *
 * It is the one section wearing the accent: it is the only thing on this page
 * that appeared without being asked for, and the dot on the header's settings
 * button sent people here to find it.
 */
export function UpdateSection() {
    const { version } = useRouteContext({ from: '__root__' })
    const updates = useUpdates()

    if (!updates.available || updates.latestVersion === null) {
        return null
    }

    return (
        <section
            aria-labelledby="settings-update"
            className="glass rounded-3xl p-6 ring-1 ring-accent/40"
        >
            <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                        <Sparkles aria-hidden className="size-4" />
                    </span>

                    <div className="min-w-0">
                        <h2 className="font-semibold" id="settings-update">
                            Umber {updates.latestVersion} is available
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                            {version === undefined
                                ? 'Downloads in your browser. Install it over this copy to keep your keys and creations.'
                                : `You are on ${version}. Install the download over this copy to keep your keys and creations.`}
                        </p>
                    </div>
                </div>

                <Button
                    className="shrink-0"
                    disabled={updates.starting}
                    onClick={updates.start}
                    size="sm"
                >
                    <ArrowDownToLine aria-hidden />
                    {updates.starting ? 'Opening' : 'Update'}
                </Button>
            </div>
        </section>
    )
}
