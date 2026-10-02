import { createHash, randomUUID } from 'node:crypto'

import type { LocalApiRequest, LocalApiResponse } from '@umber/ui/local-api'

import { HttpError } from './http'

export type Dispatch = (request: LocalApiRequest) => Promise<LocalApiResponse>

interface Job {
    readonly id: string
    readonly key: string
    readonly fingerprint: string
    readonly createdAt: number
    status: 'running' | 'succeeded' | 'failed'
    response?: LocalApiResponse
}

/** Bounded metadata only in normal use. No worker, queue or polling timer. */
export class ApiJobs {
    private readonly jobs = new Map<string, Job>()
    private active = false

    constructor(private readonly dispatch: Dispatch) {}

    submit(body: unknown, key: string | undefined) {
        if (key === undefined || !/^[\w.-]{1,128}$/u.test(key)) {
            throw new HttpError(
                400,
                'idempotency_key_required',
                'Send a unique Idempotency-Key header of 1 to 128 letters, digits, dots, dashes or underscores.',
            )
        }
        const fingerprint = createHash('sha256').update(JSON.stringify(body)).digest('hex')
        const existing = [...this.jobs.values()].find((job) => job.key === key)
        if (existing !== undefined) {
            if (existing.fingerprint !== fingerprint)
                throw new HttpError(
                    409,
                    'idempotency_conflict',
                    'This Idempotency-Key was used for a different request.',
                )
            return this.describe(existing)
        }
        if (this.active)
            throw new HttpError(
                429,
                'api_busy',
                'One API generation is already running. Poll it before submitting another.',
            )
        // Evict on demand, never by a background interval.
        while (this.jobs.size >= 32) {
            const oldest = this.jobs.keys().next().value
            if (oldest !== undefined) this.jobs.delete(oldest)
        }
        const job: Job = {
            id: randomUUID(),
            key,
            fingerprint,
            createdAt: Date.now(),
            status: 'running',
        }
        this.jobs.set(job.id, job)
        this.active = true
        void this.run(job, body)
        return this.describe(job)
    }

    get(id: string) {
        const job = this.jobs.get(id)
        if (job === undefined)
            throw new HttpError(
                404,
                'job_not_found',
                'This job is not in the current session. Saved images remain available by image ID.',
            )
        return this.describe(job)
    }

    get busy(): boolean {
        return this.active
    }

    clear(): void {
        this.jobs.clear()
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

    private async run(job: Job, body: unknown): Promise<void> {
        try {
            job.response = await this.dispatch({ id: job.id, action: 'generate', body })
            job.status = job.response.status < 400 ? 'succeeded' : 'failed'
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
            this.active = false
        }
    }
}
