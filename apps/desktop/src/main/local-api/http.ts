import type { IncomingMessage, ServerResponse } from 'node:http'

import type { LocalApiResponse } from '@umber/ui/local-api'

export class HttpError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string,
    ) {
        super(message)
    }
}

export function requireLocalClient(request: IncomingMessage, port: number): void {
    if (request.headers.host !== `127.0.0.1:${port}` || request.headers.origin !== undefined) {
        throw new HttpError(
            403,
            'local_clients_only',
            'Use a local API client at 127.0.0.1, without an Origin header.',
        )
    }
}

export async function readBody(request: IncomingMessage): Promise<unknown> {
    if (request.headers['content-type']?.split(';')[0]?.trim() !== 'application/json') {
        throw new HttpError(415, 'json_required', 'Send Content-Type: application/json.')
    }
    const limit = 24 * 1024 * 1024
    if (Number(request.headers['content-length']) > limit) {
        request.resume()
        throw new HttpError(413, 'body_too_large', 'The JSON body must be at most 24 MiB.')
    }
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        size += bytes.length
        if (size > limit) {
            request.resume()
            throw new HttpError(413, 'body_too_large', 'The JSON body must be at most 24 MiB.')
        }
        chunks.push(bytes)
    }
    try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
    } catch {
        throw new HttpError(400, 'invalid_json', 'The request body is not valid JSON.')
    }
}

export function send(response: ServerResponse, result: LocalApiResponse): void {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.statusCode = result.status
    if ('bytes' in result) {
        response.setHeader('Content-Type', result.mediaType)
        response.setHeader('Content-Disposition', 'attachment')
        response.end(result.bytes)
    } else {
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.end(JSON.stringify(result.body))
    }
}

export function failure(error: unknown): LocalApiResponse {
    return error instanceof HttpError
        ? { status: error.status, body: { error: { code: error.code, message: error.message } } }
        : {
              status: 500,
              body: {
                  error: {
                      code: 'internal_error',
                      message: 'Umber could not complete this request.',
                  },
              },
          }
}
