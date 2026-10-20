import { readFile } from 'node:fs/promises'

import type { LimitPeriod, LimitUsage, SpendingLimit } from '@umber/ui/local-api'

import { HttpError } from './http'
import { writeJson } from './preferences'

const DAY = 86_400_000
/** The longest rolling window on offer. Older entries only matter to the all-time total. */
const RETAINED = 30 * DAY

interface Entry {
    readonly at: number
    readonly usd: number
}

interface Ledger {
    readonly allTime: number
    readonly entries: readonly Entry[]
}

const EMPTY: Ledger = { allTime: 0, entries: [] }

function isEntry(value: unknown): value is Entry {
    return (
        typeof value === 'object' &&
        value !== null &&
        'at' in value &&
        'usd' in value &&
        typeof value.at === 'number' &&
        typeof value.usd === 'number'
    )
}

function parseLedger(value: unknown): Ledger {
    if (
        typeof value === 'object' &&
        value !== null &&
        'allTime' in value &&
        'entries' in value &&
        typeof value.allTime === 'number' &&
        Array.isArray(value.entries)
    ) {
        return { allTime: value.allTime, entries: value.entries.filter(isEntry) }
    }
    return EMPTY
}

const money = (amount: number) => `$${amount.toFixed(2)}`

function periodText(days: LimitPeriod): string {
    if (days === null) return 'in total'
    return days === 1 ? 'per day' : `every ${days} days`
}

/**
 * Estimated USD that finished API generations cost, kept by the main process
 * rather than the gallery's usage history so deleting creations cannot reset a
 * limit. Generations still running hold their estimate until they finish.
 */
export class SpendLedger {
    private reserved = 0
    private writes: Promise<unknown> = Promise.resolve()

    private constructor(
        private readonly path: string,
        private ledger: Ledger,
    ) {}

    static async open(path: string): Promise<SpendLedger> {
        try {
            return new SpendLedger(path, parseLedger(JSON.parse(await readFile(path, 'utf8'))))
        } catch {
            return new SpendLedger(path, EMPTY)
        }
    }

    spent(days: LimitPeriod, now = Date.now()): number {
        if (days === null) return this.ledger.allTime
        const since = now - days * DAY
        return this.ledger.entries.reduce(
            (sum, entry) => (entry.at > since ? sum + entry.usd : sum),
            0,
        )
    }

    usage(limits: readonly SpendingLimit[]): readonly LimitUsage[] {
        return limits.map(({ days, usd }) => ({ usd, days, spent: this.spent(days) }))
    }

    /** What an agent can still spend under each limit, counting generations in flight. */
    remaining(limits: readonly SpendingLimit[]) {
        return this.usage(limits).map(({ days, spent, usd }) => ({
            usd,
            days,
            spent,
            remaining: Math.max(0, usd - spent - this.reserved),
        }))
    }

    /**
     * Holds `cost` against every limit, or throws a 402 naming the limit it
     * would pass. An unknown cost cannot be checked, so it is refused whenever
     * any limit exists. Returns the release for when the generation settles.
     */
    reserve(limits: readonly SpendingLimit[], cost: number | null): () => void {
        if (limits.length > 0 && cost === null)
            throw new HttpError(
                402,
                'cost_unknown',
                'This request has no cost estimate, so it cannot run while a spending limit is set.',
            )
        const amount = cost ?? 0
        for (const limit of this.remaining(limits)) {
            // A tenth of a cent of slack absorbs floating point sums.
            if (amount > limit.remaining + 0.001)
                throw new HttpError(
                    402,
                    'spending_limit',
                    `This request costs about ${money(amount)}. Your limit of ${money(limit.usd)} ${periodText(limit.days)} has ${money(limit.remaining)} left.`,
                )
        }
        this.reserved += amount
        let held = true
        return () => {
            if (held) this.reserved -= amount
            held = false
        }
    }

    /** Counts a finished generation. Memory updates at once; the file write follows. */
    record(amount: number, now = Date.now()): Promise<void> {
        if (!(amount > 0)) return Promise.resolve()
        this.ledger = {
            allTime: this.ledger.allTime + amount,
            entries: [
                ...this.ledger.entries.filter((entry) => entry.at > now - RETAINED),
                { at: now, usd: amount },
            ],
        }
        return this.persist()
    }

    clear(): Promise<void> {
        this.ledger = EMPTY
        return this.persist()
    }

    private persist(): Promise<void> {
        const snapshot = this.ledger
        const write = this.writes.then(() => writeJson(this.path, snapshot))
        this.writes = write.catch(() => null)
        return write
    }
}
