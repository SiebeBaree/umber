import { createHash, randomUUID } from 'node:crypto'

import type {
    LocalApiKind,
    LocalApiRequest,
    LocalApiResponse,
    SpendingLimit,
} from '@umber/ui/local-api'

import { HttpError } from './http'
import type { SpendLedger } from './spend'

export type Dispatch = (request: LocalApiRequest) => Promise<LocalApiResponse>

export interface JobsOptions {
    readonly dispatch: Dispatch
    readonly ledger: SpendLedger
    readonly limits: () => readonly SpendingLimit[]
    /** Called once a generation settles and its spend is counted. */
    readonly settled: () => void
}

interface Job {
    readonly id: string
    readonly key: string
    readonly fingerprint: string
    readonly kind: LocalApiKind
    readonly createdAt: number
    status: 'running' | 'succeeded' | 'failed'
    response?: LocalApiResponse
}

/** The estimate the renderer reported, or null when it could not price the request. */
function estimatedTotal(response: LocalApiResponse): number | null {
    if (!('body' in response)) return null
    const { body } = response
    if (typeof body !== 'object' || body === null || !('estimatedTotalCost' in body)) return null
    return typeof body.estimatedTotalCost === 'number' && Number.isFinite(body.estimatedTotalCost)
        ? body.estimatedTotalCost
        : null
}

/** Bounded metadata only in normal use. No worker, queue or polling timer. */
export class ApiJobs {
    private readonly jobs = new Map<string, Job>()
    /** One image and one video generation may run side by side. */
    private readonly active = new Set<LocalApiKind>()
    private admission: Promise<unknown> = Promise.resolve()

    constructor(private readonly options: JobsOptions) {}

    /**
     * Admissions run one at a time: each prices its request, then holds that
     * estimate against the spending limits, so two submissions can never both
     * squeeze under the same limit.
     */
    submit(kind: LocalApiKind, body: unknown, key: string | undefined): Promise<LocalApiResponse> {
        if (key === undefined || !/^[\w.-]{1,128}$/u.test(key)) {
            throw new HttpError(
                400,
                'idempotency_key_required',
                'Send a unique Idempotency-Key header of 1 to 128 letters, digits, dots, dashes or underscores.',
            )
        }
        const fingerprint = createHash('sha256')
            .update(JSON.stringify([kind, body]))
            .digest('hex')
        const result = this.admission.then(() => this.admit(kind, body, key, fingerprint))
        this.admission = result.catch(() => null)
        return result
    }

    get(id: string) {
        const job = this.jobs.get(id)
        if (job === undefined)
            throw new HttpError(
                404,
                'job_not_found',
                'This job is not in the current session. Saved creations remain available by ID.',
            )
        return this.describe(job)
    }

    get busy(): boolean {
        return this.active.size > 0
    }

    clear(): void {
        this.jobs.clear()
    }

    private async admit(
        kind: LocalApiKind,
        body: unknown,
        key: string,
        fingerprint: string,
    ): Promise<LocalApiResponse> {
        const existing = [...this.jobs.values()].find((job) => job.key === key)
        if (existing !== undefined) {
            if (existing.fingerprint !== fingerprint)
                throw new HttpError(
                    409,
                    'idempotency_conflict',
                    'This Idempotency-Key was used for a different request.',
                )
            return { status: 202, body: this.describe(existing) }
        }
        if (this.active.has(kind))
            throw new HttpError(
                429,
                'api_busy',
                `An API ${kind} generation is already running. Poll it before submitting another.`,
            )
        // Validation failures answer here, before any job exists or any provider is called.
        const estimate = await this.options.dispatch({
            id: randomUUID(),
            action: 'estimate',
            kind,
            body,
        })
        if (estimate.status !== 200) return estimate
        const cost = estimatedTotal(estimate)
        const release = this.options.ledger.reserve(this.options.limits(), cost)
        // Evict on demand, never by a background interval.
        while (this.jobs.size >= 32) {
            const oldest = this.jobs.keys().next().value
            if (oldest !== undefined) this.jobs.delete(oldest)
        }
        const job: Job = {
            id: randomUUID(),
            key,
            fingerprint,
            kind,
            createdAt: Date.now(),
            status: 'running',
        }
        this.jobs.set(job.id, job)
        this.active.add(kind)
        void this.run(job, body, cost, release)
        return { status: 202, body: this.describe(job) }
    }

    private describe(job: Job) {
        return {
            id: job.id,
            status: job.status,
            createdAt: job.createdAt,
            pollUrl: `/v1/generations/${job.id}`,
            ...(job.response === undefined
                ? {}
                : {
                      result: 'body' in job.response ? job.response.body : null,
                      resultStatus: job.response.status,
                  }),
        }
    }

    private async run(
        job: Job,
        body: unknown,
        cost: number | null,
        release: () => void,
    ): Promise<void> {
        // A lost renderer may still have been charged, so it counts the estimate.
        let spent = cost ?? 0
        try {
            const response = await this.options.dispatch({
                id: job.id,
                action: 'generate',
                kind: job.kind,
                body,
            })
            job.response = response
            job.status = response.status < 400 ? 'succeeded' : 'failed'
            spent = job.status === 'succeeded' ? (estimatedTotal(response) ?? 0) : 0
        } catch {
            job.status = 'failed'
            job.response = {
                status: 503,
                body: {
                    error: {
                        code: 'renderer_unavailable',
                        message:
                            'The Umber window stopped responding. The provider may have accepted the request. Check the gallery before retrying.',
                    },
                },
            }
        } finally {
            // Count before releasing the hold, so the spend is never briefly invisible.
            void this.options.ledger.record(spent).catch(() => null)
            release()
            this.active.delete(job.kind)
            this.options.settled()
        }
    }
}
