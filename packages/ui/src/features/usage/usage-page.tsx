import { useEffect, useMemo, useState } from 'react'

import {
    SegmentedControl,
    type SegmentedControlOption,
} from '../../components/ui/segmented-control'
import { listUsage, type UsageRecord } from '../gallery/creations-db'
import { useGeneration } from '../generate/generation-context'
import { UsageChart } from './usage-chart'
import { summarizeUsage, type UsagePeriod } from './usage-summary'
import { UsageModels, UsageTotals } from './usage-totals'

const PERIODS: readonly SegmentedControlOption<UsagePeriod>[] = [
    { value: '7', label: '7 days' },
    { value: '30', label: '30 days' },
    { value: '365', label: '1 year' },
]
function useUsage() {
    const [records, setRecords] = useState<readonly UsageRecord[] | null>(null)
    const [error, setError] = useState(false)
    const { completions } = useGeneration()
    useEffect(() => {
        let active = true
        const load = async () => {
            try {
                const next = await listUsage()
                if (active) {
                    setRecords(next)
                    setError(false)
                }
            } catch {
                if (active) setError(true)
            }
        }
        void load()
        return () => {
            active = false
        }
    }, [completions])
    return { records, error }
}
export function UsagePage() {
    const [period, setPeriod] = useState<UsagePeriod>('7')
    const { records, error } = useUsage()
    const summary = useMemo(() => summarizeUsage(records ?? [], period), [records, period])
    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
                <SegmentedControl
                    aria-label="Usage period"
                    onValueChange={setPeriod}
                    options={PERIODS}
                    value={period}
                />
            </div>
            {error ? (
                <p className="mt-8 text-sm" role="alert">
                    Could not load usage from this device.
                </p>
            ) : records === null ? (
                <output className="mt-8 block text-sm text-muted">Loading usage…</output>
            ) : (
                <>
                    <UsageTotals summary={summary} />
                    <UsageChart buckets={summary.buckets} period={period} />
                    <UsageModels summary={summary} />
                    <p className="mt-8 text-xs leading-relaxed text-muted">
                        Successful creations on this device. Costs are USD estimates saved at
                        generation time. Your provider may also charge for prompts, uploaded images
                        and failed requests.
                    </p>
                </>
            )}
        </div>
    )
}
