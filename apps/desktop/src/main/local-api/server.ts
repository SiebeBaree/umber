import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'

import type { LocalApiKind, LocalApiResponse, LocalApiSettings } from '@umber/ui/local-api'

import { failure, HttpError, readBody, requireLocalClient, send } from './http'
import { ApiJobs, type Dispatch } from './jobs'
import { kindsOf } from './preferences'
import type { SpendLedger } from './spend'

export interface ApiServerOptions {
    readonly port: number
    readonly docs: string
    readonly dispatch: Dispatch
    readonly ledger: SpendLedger
    /** Read per request, so a settings change applies to the very next call. */
    readonly settings: () => LocalApiSettings
    readonly settled: () => void
}

/** A single Node HTTP listener inside Electron's existing main process. */
export class LocalApiServer {
    private server: Server | undefined
    private port = 0
    private readonly jobs: ApiJobs

    constructor(private readonly options: ApiServerOptions) {
        this.jobs = new ApiJobs({
            dispatch: options.dispatch,
            ledger: options.ledger,
            limits: () => options.settings().limits,
            settled: options.settled,
        })
    }

    async start(): Promise<number> {
        if (this.server !== undefined) return this.port
        const server = createServer((request, response) => {
            void this.route(request)
                .then((result) => send(response, result))
                .catch((error: unknown) => {
                    send(response, failure(error))
                })
        })
        server.requestTimeout = 30_000
        server.headersTimeout = 10_000
        server.keepAliveTimeout = 5_000
        server.maxConnections = 16
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject)
            server.listen(this.options.port, '127.0.0.1', () => {
                server.removeListener('error', reject)
                resolve()
            })
        })
        const address = server.address()
        if (address === null || typeof address === 'string') throw new Error('No local API address')
        this.port = address.port
        this.server = server
        return this.port
    }

    async stop(): Promise<void> {
        const server = this.server
        this.server = undefined
        if (server === undefined) return
        await new Promise<void>((resolve, reject) => {
            server.close((error) => (error === undefined ? resolve() : reject(error)))
            server.closeAllConnections()
        })
    }

    get busy(): boolean {
        return this.jobs.busy
    }

    clearJobs(): void {
        this.jobs.clear()
    }

    private async route(request: IncomingMessage): Promise<LocalApiResponse> {
        requireLocalClient(request, this.port)
        const path = new URL(request.url ?? '/', `http://127.0.0.1:${this.port}`).pathname
        if (request.method === 'GET' && (path === '/' || path === '/llms.txt')) {
            return {
                status: 200,
                bytes: new TextEncoder().encode(this.options.docs),
                mediaType: 'text/plain; charset=utf-8',
            }
        }
        if (request.method === 'GET') return this.get(path)
        const post = /^\/v1\/(images|videos)\/(generations|estimate)$/u.exec(path)
        if (request.method === 'POST' && post?.[1] !== undefined) {
            const kind = this.allowed(post[1])
            const body = await readBody(request)
            if (post[2] === 'estimate') return this.estimate(kind, body)
            const key = request.headers['idempotency-key']
            if (Array.isArray(key))
                throw new HttpError(
                    400,
                    'invalid_idempotency_key',
                    'Send one Idempotency-Key header.',
                )
            return this.jobs.submit(kind, body, key)
        }
        throw new HttpError(404, 'not_found', 'Unknown endpoint. Read GET /llms.txt.')
    }

    private get(path: string): Promise<LocalApiResponse> | LocalApiResponse {
        if (path === '/v1/models')
            return this.options.dispatch({
                id: randomUUID(),
                action: 'models',
                body: { kinds: kindsOf(this.options.settings().access) },
            })
        const job = /^\/v1\/generations\/([\w-]+)$/u.exec(path)
        if (job?.[1] !== undefined) return { status: 200, body: this.jobs.get(job[1]) }
        const creation = /^\/v1\/(images|videos)\/([\w-]+)(\/file)?$/u.exec(path)
        if (creation?.[1] !== undefined && creation[2] !== undefined) {
            return this.options.dispatch({
                id: randomUUID(),
                action: creation[3] === undefined ? 'read' : 'file',
                kind: this.allowed(creation[1]),
                body: creation[2],
            })
        }
        throw new HttpError(404, 'not_found', 'Unknown endpoint. Read GET /llms.txt.')
    }

    /** The kind a route serves, or a 403 when the settings turn it off. */
    private allowed(segment: string): LocalApiKind {
        const kind: LocalApiKind = segment === 'videos' ? 'video' : 'image'
        if (!kindsOf(this.options.settings().access).includes(kind))
            throw new HttpError(
                403,
                'feature_disabled',
                `${kind === 'image' ? 'Images are' : 'Videos are'} turned off for the local API. Allow them in Umber Settings.`,
            )
        return kind
    }

    /** The renderer's estimate, plus what each spending limit still allows. */
    private async estimate(kind: LocalApiKind, body: unknown): Promise<LocalApiResponse> {
        const response = await this.options.dispatch({
            id: randomUUID(),
            action: 'estimate',
            kind,
            body,
        })
        if (response.status !== 200 || !('body' in response)) return response
        const limits = this.options.ledger.remaining(this.options.settings().limits)
        return typeof response.body === 'object' && response.body !== null
            ? { status: 200, body: { ...response.body, limits } }
            : response
    }
}
