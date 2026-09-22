import { useMemo, useState } from 'react'

import { SegmentedControl } from '../../components/ui/segmented-control'
import { formatCost } from '../create/pricing'
import type { UsageBucket, UsagePeriod } from './usage-summary'

const METRICS = [
    { value: 'cost', label: 'Cost' },
    { value: 'count', label: 'Creations' },
] as const
function UsageBar({
    bucket,
    period,
    height,
}: {
    readonly bucket: UsageBucket
    readonly period: UsagePeriod
    readonly height: number
}) {
    const style = useMemo(() => ({ height: `${height}%` }), [height])
    const date = new Date(bucket.date).toLocaleDateString(undefined, {
        month: 'short',
        ...(period === '365' ? { year: 'numeric' } : { day: 'numeric' }),
    })
    const label = `${date}: ${bucket.count} creations, ${formatCost(bucket.cost)} estimated${bucket.unknown > 0 ? `, ${bucket.unknown} without recorded cost` : ''}`
    return (
        <button
            aria-label={label}
            className="group relative flex h-full min-w-0 flex-1 cursor-default items-end outline-none focus-visible:ring-2 focus-visible:ring-accent"
            type="button"
        >
            <span
                className="w-full rounded-t-sm bg-accent/70 group-hover:bg-accent group-focus:bg-accent"
                style={style}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-44 -translate-x-1/2 rounded-xl bg-surface p-3 text-left text-xs shadow-lg group-hover:block group-focus:block">
                {label}
            </span>
        </button>
    )
}
export function UsageChart({
    buckets,
    period,
}: {
    readonly buckets: readonly UsageBucket[]
    readonly period: UsagePeriod
}) {
    const [metric, setMetric] = useState<'cost' | 'count'>('cost')
    const maximum = Math.max(...buckets.map((bucket) => bucket[metric]), 1e-6)
    return (
        <>
            <div className="flex justify-end">
                <SegmentedControl
                    aria-label="Chart metric"
                    onValueChange={setMetric}
                    options={METRICS}
                    value={metric}
                />
            </div>
            <fieldset
                aria-label={metric === 'cost' ? 'Estimated cost over time' : 'Creations over time'}
                className="mt-6 flex h-48 min-w-0 items-end gap-1 border-b border-ink/10"
            >
                {buckets.map((bucket) => (
                    <UsageBar
                        bucket={bucket}
                        height={Math.max(1, (bucket[metric] / maximum) * 100)}
                        key={bucket.date}
                        period={period}
                    />
                ))}
            </fieldset>
            <div className="mt-2 flex justify-between text-xs text-muted">
                <span>
                    {new Date(buckets[0]?.date ?? Date.now()).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                    })}
                </span>
                <span>Today</span>
            </div>
        </>
    )
}
