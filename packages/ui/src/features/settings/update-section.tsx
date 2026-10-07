import { RefreshCw, Sparkles } from 'lucide-react'

import { Button } from '../../components/ui/button'
import type { UpdateStatus } from '../updates/checker'
import { useUpdates } from '../updates/updates-context'

function describeUpdate(status: UpdateStatus): string {
    switch (status.state) {
        case 'downloading':
            return status.percent === 100
                ? 'Preparing the update. You can keep using Umber.'
                : `Downloading ${status.percent}%. You can keep using Umber.`
        case 'ready':
            return 'Restart to apply the update, or keep working and it will install when you quit.'
        case 'installing':
            return 'Restarting to apply the update.'
        case 'error':
            return status.message
        default:
            return ''
    }
}

/** Uses the existing update notice for download progress, recovery and restart. */
export function UpdateSection() {
    const { status, retry, restart } = useUpdates()
    if (status.state === 'idle' || status.state === 'checking') return null

    const title =
        status.state === 'error'
            ? 'Update interrupted'
            : status.state === 'ready'
              ? `Umber ${status.latestVersion} is ready`
              : `Updating to Umber ${status.latestVersion}`

    return (
        <section
            aria-labelledby="settings-update"
            className="glass rounded-3xl p-6 ring-1 ring-accent/40"
        >
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                        <Sparkles aria-hidden className="size-4" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="font-semibold" id="settings-update">
                            {title}
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                            {describeUpdate(status)}
                        </p>
                    </div>
                </div>
                {status.state === 'ready' || status.state === 'error' ? (
                    <Button
                        className="shrink-0"
                        onClick={status.state === 'ready' ? restart : retry}
                        size="sm"
                    >
                        <RefreshCw aria-hidden />
                        {status.state === 'ready' ? 'Restart to update' : 'Try again'}
                    </Button>
                ) : null}
            </div>
        </section>
    )
}
