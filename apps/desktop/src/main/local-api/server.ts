import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server } from 'node:http'

import type { LocalApiResponse } from '@umber/ui/local-api'

import { failure, HttpError, readBody, requireLocalClient, send } from './http'
import { ApiJobs, type Dispatch } from './jobs'

export interface ApiServerOptions {
    readonly port: number
    readonly docs: string
    readonly dispatch: Dispatch
}

/** A single Node HTTP listener inside Electron's existing main process. */
export class LocalApiServer {
    private server: Server | undefined
    private port = 0
    private readonly jobs: ApiJobs

    constructor(private readonly options: ApiServerOptions) {
        this.jobs = new ApiJobs(options.dispatch)
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
        if (request.method === 'POST' && path === '/v1/images/generations') {
            const body = await readBody(request)
            const key = request.headers['idempotency-key']
            if (Array.isArray(key))
                throw new HttpError(
                    400,
                    'invalid_idempotency_key',
                    'Send one Idempotency-Key header.',
                )
            return { status: 202, body: this.jobs.submit(body, key) }
        }
        if (request.method === 'POST' && path === '/v1/images/estimate') {
            return this.options.dispatch({
                id: randomUUID(),
                action: 'estimate',
                body: await readBody(request),
            })
        }
        throw new HttpError(
            404,
            'not_found',
            'Unknown endpoint. Read GET /llms.txt. Only image models are supported.',
        )
    }

    private get(path: string): Promise<LocalApiResponse> | LocalApiResponse {
        if (path === '/v1/models')
            return this.options.dispatch({ id: randomUUID(), action: 'models', body: null })
        const job = /^\/v1\/generations\/([\w-]+)$/u.exec(path)
        if (job?.[1] !== undefined) return { status: 200, body: this.jobs.get(job[1]) }
        const image = /^\/v1\/images\/([\w-]+)(\/file)?$/u.exec(path)
        if (image?.[1] !== undefined) {
            return this.options.dispatch({
                id: randomUUID(),
                action: image[2] === undefined ? 'image' : 'file',
                body: image[1],
            })
        }
        throw new HttpError(404, 'not_found', 'Unknown endpoint. Read GET /llms.txt.')
    }
}
