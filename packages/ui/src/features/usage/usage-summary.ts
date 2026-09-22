import type { UsageRecord } from '../gallery/creations-db'

export type UsagePeriod = '7' | '30' | '365'
interface Totals {
    count: number
    cost: number
    unknown: number
    timed: number
    totalMs: number
}
export interface UsageBucket extends Totals {
    readonly date: number
}
function emptyTotals(): Totals {
    return { count: 0, cost: 0, unknown: 0, timed: 0, totalMs: 0 }
}
function addRecord(totals: Totals, record: UsageRecord) {
    totals.count += 1
    if (record.estimatedCost == null) totals.unknown += 1
    else totals.cost += record.estimatedCost
    if (record.generationMs !== undefined) {
        totals.timed += 1
        totals.totalMs += record.generationMs
    }
}
function bucketKey(date: Date, period: UsagePeriod) {
    const month = `${date.getFullYear()}-${date.getMonth()}`
    return period === '365' ? month : `${month}-${date.getDate()}`
}
function makeBuckets(start: Date, now: number, period: UsagePeriod) {
    const buckets = new Map<string, UsageBucket>()
    for (const day = new Date(start); day.getTime() <= now; day.setDate(day.getDate() + 1)) {
        const key = bucketKey(day, period)
        if (!buckets.has(key)) buckets.set(key, { date: day.getTime(), ...emptyTotals() })
    }
    return buckets
}

/** Local calendar days, including today. Year view groups by calendar month. */
export function summarizeUsage(
    records: readonly UsageRecord[],
    period: UsagePeriod,
    now = Date.now(),
) {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - Number(period) + 1)
    const buckets = makeBuckets(start, now, period)
    const models = new Map<string, Totals & { name: string }>()
    const totals = emptyTotals()
    for (const record of records) {
        if (record.createdAt < start.getTime() || record.createdAt > now) continue
        const bucket = buckets.get(bucketKey(new Date(record.createdAt), period))
        if (bucket === undefined) continue
        const model = models.get(record.modelId) ?? { name: record.modelName, ...emptyTotals() }
        addRecord(totals, record)
        addRecord(bucket, record)
        addRecord(model, record)
        models.set(record.modelId, model)
    }
    return {
        ...totals,
        averageMs: totals.timed === 0 ? null : totals.totalMs / totals.timed,
        buckets: [...buckets.values()],
        models: [...models.entries()].toSorted((a, b) => b[1].count - a[1].count),
    }
}
export type UsageSummary = ReturnType<typeof summarizeUsage>
