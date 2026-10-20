import { Check, Copy, Plus, X } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'

import { Button } from '../../components/ui/button'
import {
    SegmentedControl,
    type SegmentedControlOption,
} from '../../components/ui/segmented-control'
import { cn } from '../../lib/cn'
import type {
    LimitUsage,
    LocalApiAccess,
    LocalApiSettings,
    LocalApiStatus,
    SpendingLimit,
} from '../local-api/contract'
import { useLocalApi } from '../local-api/local-api-context'
import { useCopyText } from '../local-api/use-copy-text'
import { AddLimitDialog, periodLabel } from './add-limit-dialog'

/**
 * The local API: one switch, what agents may generate, and how much they may
 * spend. The shell owns the listener and enforces all three; this section only
 * reads and writes the settings.
 */

const ACCESS_OPTIONS: readonly SegmentedControlOption<LocalApiAccess>[] = [
    { value: 'images', label: 'Images' },
    { value: 'videos', label: 'Videos' },
    { value: 'both', label: 'Both' },
]

const ACCESS_NOUNS: Readonly<Record<LocalApiAccess, string>> = {
    images: 'images',
    videos: 'videos',
    both: 'images and videos',
}

/** Whole dollars stay whole, so a limit reads "$10" rather than "$10.00". */
function formatUsd(amount: number): string {
    return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`
}

function EnabledSwitch({
    checked,
    disabled,
    onChange,
}: {
    readonly checked: boolean
    readonly disabled: boolean
    readonly onChange: () => void
}) {
    return (
        <button
            aria-checked={checked}
            aria-label="Enable local API"
            className={cn(
                'relative h-6 w-10 shrink-0 cursor-pointer rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:opacity-45',
                checked ? 'bg-accent' : 'bg-ink/15',
            )}
            disabled={disabled}
            onClick={onChange}
            role="switch"
            type="button"
        >
            <span
                aria-hidden
                className={cn(
                    'absolute top-0.5 size-5 rounded-full bg-white shadow-sm',
                    checked ? 'left-[18px]' : 'left-0.5',
                )}
            />
        </button>
    )
}

function CopyForAgent({ status }: { readonly status: LocalApiStatus }) {
    const instructions = `Use Umber to generate ${ACCESS_NOUNS[status.access]} on this computer. Read ${status.baseUrl}/llms.txt first for endpoints, arguments and examples.`
    const { copied, failed, copy, reset } = useCopyText(instructions)
    return (
        <Button onBlur={reset} onClick={copy} size="sm" variant="glass">
            {copied ? <Check aria-hidden className="text-accent" /> : <Copy aria-hidden />}
            {copied ? 'Copied' : failed ? 'Could not copy' : 'Copy for agent'}
        </Button>
    )
}

/** Running, starting or failed, in the line under the title. */
function StatusLine({
    status,
    error,
}: {
    readonly status: LocalApiStatus
    readonly error: string | null
}) {
    const problem = error ?? status.error
    if (problem !== null) return <p className="mt-0.5 text-[13px] text-rose-600">{problem}</p>
    if (!status.enabled) return null
    return (
        <p className="mt-0.5 text-[13px] text-muted">
            {status.listening ? `Running at ${new URL(status.baseUrl).host}` : 'Starting...'}
        </p>
    )
}

function LimitRow({
    limit,
    onRemove,
}: {
    readonly limit: LimitUsage
    readonly onRemove: (limit: LimitUsage) => void
}) {
    const reached = limit.spent >= limit.usd
    const name = `${formatUsd(limit.usd)} ${periodLabel(limit.days)}`
    const remove = useCallback(() => onRemove(limit), [limit, onRemove])
    const fill = useMemo(
        () => ({ width: `${Math.min(100, (limit.spent / limit.usd) * 100)}%` }),
        [limit.spent, limit.usd],
    )
    return (
        <li className="py-3">
            <div className="flex items-center gap-3">
                <span className="flex-1 text-sm font-medium">{name}</span>
                <span
                    className={cn(
                        'text-[13px] tabular-nums',
                        reached ? 'text-rose-600' : 'text-muted',
                    )}
                >
                    ${limit.spent.toFixed(2)} spent
                </span>
                <Button
                    aria-label={`Remove the ${name} limit`}
                    className="-me-2"
                    onClick={remove}
                    size="icon-sm"
                    variant="ghost"
                >
                    <X aria-hidden />
                </Button>
            </div>
            <div
                aria-hidden
                className="me-9 mt-2 h-[3px] overflow-hidden rounded-full bg-ink/[0.08]"
            >
                <div
                    className={cn('h-full rounded-full', reached ? 'bg-rose-600' : 'bg-accent')}
                    style={fill}
                />
            </div>
        </li>
    )
}

function SpendingLimits({
    limits,
    onChange,
}: {
    readonly limits: readonly LimitUsage[]
    readonly onChange: (limits: readonly SpendingLimit[]) => void
}) {
    const [adding, setAdding] = useState(false)
    const open = useCallback(() => setAdding(true), [])
    const settings = useMemo(() => limits.map(({ days, usd }) => ({ days, usd })), [limits])
    const add = useCallback(
        (limit: SpendingLimit) => onChange([...settings, limit]),
        [settings, onChange],
    )
    const remove = useCallback(
        (limit: SpendingLimit) => onChange(settings.filter((kept) => kept.days !== limit.days)),
        [settings, onChange],
    )
    return (
        <div className="mt-5 border-t border-ink/[0.07] pt-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-[13px] font-semibold">Spending limits</h3>
                <Button className="-me-2.5" onClick={open} size="sm" variant="ghost">
                    <Plus aria-hidden />
                    Add limit
                </Button>
            </div>
            {limits.length === 0 ? (
                <p className="mt-1 text-[13px] text-muted">None. Agents can spend without a cap.</p>
            ) : (
                <ul className="mt-1 divide-y divide-ink/[0.06]">
                    {limits.map((limit) => (
                        <LimitRow key={String(limit.days)} limit={limit} onRemove={remove} />
                    ))}
                </ul>
            )}
            <AddLimitDialog onAdd={add} onOpenChange={setAdding} open={adding} />
        </div>
    )
}

/** The settings the section writes, as stable callbacks. */
function useSettingsActions(
    status: LocalApiStatus | null,
    update: (patch: Partial<LocalApiSettings>) => void,
) {
    const toggle = useCallback(() => {
        if (status !== null) update({ enabled: !status.enabled })
    }, [status, update])
    const setAccess = useCallback((access: LocalApiAccess) => update({ access }), [update])
    const setLimits = useCallback(
        (limits: readonly SpendingLimit[]) => update({ limits }),
        [update],
    )
    return { toggle, setAccess, setLimits }
}

export function LocalApiSection() {
    const { available, busy, error, status, update } = useLocalApi()
    const { setAccess, setLimits, toggle } = useSettingsActions(status, update)
    if (!available) return null
    return (
        <section aria-labelledby="settings-local-api" className="glass rounded-3xl p-6">
            <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                    <h2 className="font-semibold" id="settings-local-api">
                        Local API
                    </h2>
                    {status === null ? null : <StatusLine error={error} status={status} />}
                </div>
                {status?.listening ? <CopyForAgent status={status} /> : null}
                <EnabledSwitch
                    checked={status?.enabled ?? false}
                    disabled={busy || status === null}
                    onChange={toggle}
                />
            </div>
            {status?.enabled ? (
                <>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-ink/[0.07] pt-4">
                        <h3 className="text-[13px] font-semibold">Agents can generate</h3>
                        <SegmentedControl
                            aria-label="What agents can generate"
                            onValueChange={setAccess}
                            options={ACCESS_OPTIONS}
                            value={status.access}
                        />
                    </div>
                    <SpendingLimits limits={status.limits} onChange={setLimits} />
                </>
            ) : null}
        </section>
    )
}
