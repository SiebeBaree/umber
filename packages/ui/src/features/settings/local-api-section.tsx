import { Check, Copy } from 'lucide-react'

import { Button } from '../../components/ui/button'
import { cn } from '../../lib/cn'
import type { LocalApiStatus } from '../local-api/contract'
import { useLocalApi } from '../local-api/local-api-context'
import { useCopyText } from '../local-api/use-copy-text'

function CopyBaseUrl({ value }: { readonly value: string }) {
    const { copied, failed, copy, reset } = useCopyText(value)
    return (
        <div className="py-3">
            <div className="flex items-center justify-between gap-3">
                <label className="text-[13px] font-medium" htmlFor="local-api-url">
                    Base URL
                </label>
                <Button
                    aria-label="Copy base URL"
                    onBlur={reset}
                    onClick={copy}
                    size="icon-sm"
                    variant="ghost"
                >
                    {copied ? <Check aria-hidden className="text-accent" /> : <Copy aria-hidden />}
                </Button>
            </div>
            <input
                aria-label="Base URL"
                className="w-full bg-transparent font-mono text-xs text-muted outline-none selection:bg-accent/20 focus:text-ink"
                id="local-api-url"
                readOnly
                type="text"
                value={value}
            />
            {failed ? (
                <output className="mt-1 block text-xs text-rose-600">
                    Could not copy. Select the value and copy it manually.
                </output>
            ) : null}
        </div>
    )
}

function ConnectionDetails({ status }: { readonly status: LocalApiStatus }) {
    const instructions = `Use Umber to generate images on this computer. Read ${status.baseUrl}/llms.txt first for endpoints, arguments and examples.`
    const { copied, failed, copy, reset } = useCopyText(instructions)
    return (
        <div className="mt-5 border-t border-ink/[0.08] pt-4">
            <p className="flex items-center gap-2 text-[13px] font-medium">
                <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                Listening on this computer
            </p>
            <div className="mt-2">
                <CopyBaseUrl value={status.baseUrl} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Button onBlur={reset} onClick={copy} size="sm" variant="glass">
                    {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                    {copied ? 'Instructions copied' : 'Copy for your agent'}
                </Button>
            </div>
            {failed ? (
                <output className="mt-2 block text-xs text-rose-600">
                    Could not copy. Copy the connection details above.
                </output>
            ) : null}
            <ApiDocumentation baseUrl={status.baseUrl} />
        </div>
    )
}

function ApiDocumentation({ baseUrl }: { readonly baseUrl: string }) {
    return (
        <details className="mt-5 text-[13px]">
            <summary className="w-fit cursor-pointer text-muted outline-accent hover:text-ink">
                API documentation
            </summary>
            <div className="mt-3 space-y-3 leading-relaxed text-muted">
                <p>
                    Agents can read the full guide at{' '}
                    <code className="text-xs text-ink">{baseUrl}/llms.txt</code>.
                </p>
                <p>
                    Use connected image models. Results appear in your gallery and include settings,
                    render time and estimated cost in USD.
                </p>
                <pre className="overflow-x-auto rounded-xl bg-ink/[0.03] p-3 text-xs text-ink">{`curl ${baseUrl}/llms.txt`}</pre>
                <p>
                    One API generation at a time. Keep Umber running. Turning this off blocks new
                    requests; an accepted generation will finish.
                </p>
            </div>
        </details>
    )
}

export function LocalApiSection() {
    const { available, busy, error, status, toggle } = useLocalApi()
    if (!available) return null
    return (
        <section aria-labelledby="settings-local-api" className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between gap-5">
                <div>
                    <h2 className="font-semibold" id="settings-local-api">
                        Local image API
                    </h2>
                    <p className="mt-1 text-[13px] leading-relaxed text-muted">
                        Let agents and scripts generate with Umber.
                    </p>
                </div>
                <button
                    aria-checked={status?.enabled ?? false}
                    aria-label="Enable local image API"
                    className={cn(
                        'relative h-6 w-10 shrink-0 cursor-pointer rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-45',
                        status?.enabled ? 'bg-accent' : 'bg-ink/15',
                    )}
                    disabled={busy || status === null}
                    onClick={toggle}
                    role="switch"
                    type="button"
                >
                    <span
                        aria-hidden
                        className={cn(
                            'absolute top-0.5 size-5 rounded-full bg-white shadow-sm',
                            status?.enabled ? 'left-[18px]' : 'left-0.5',
                        )}
                    />
                </button>
            </div>
            {status?.listening ? <ConnectionDetails status={status} /> : null}
            {status?.enabled && !status.listening && !status.error ? (
                <output className="mt-3 block text-[13px] text-muted">Starting local API...</output>
            ) : null}
            {error || status?.error ? (
                <output className="mt-3 block text-[13px] text-rose-600">
                    {error ?? status?.error}
                </output>
            ) : null}
        </section>
    )
}
