/**
 * How provider integrations reach the network.
 *
 * Provider APIs are server-to-server by design: most of them send no CORS
 * headers, so a plain `fetch` from a sandboxed renderer dies in preflight. The
 * desktop shell therefore routes requests through the main process, which is
 * not subject to CORS — and everything without a shell (the browser preview,
 * tests) falls back to `fetch` and simply reaches whichever providers allow it.
 *
 * Integrations call `httpFetch` and get a standard `Response` back either way;
 * the transport behind it is the shell's business, injected once at mount.
 */

/** A multipart body, decomposed so it can cross an IPC boundary. */
export type HttpFormPart =
    | { readonly kind: 'field'; readonly name: string; readonly value: string }
    | {
          readonly kind: 'file'
          readonly name: string
          readonly filename: string
          readonly contentType: string
          readonly bytes: Uint8Array
      }

/** A request body in one of the shapes every transport can carry. */
export type HttpBody =
    | { readonly kind: 'text'; readonly text: string; readonly contentType: string }
    | { readonly kind: 'form'; readonly parts: readonly HttpFormPart[] }

export interface HttpRequestData {
    readonly url: string
    readonly method: string
    readonly headers: Readonly<Record<string, string>>
    readonly body?: HttpBody
}

/** What a transport hands back; enough to rebuild a `Response`. */
export interface HttpResponseData {
    readonly status: number
    readonly headers: Readonly<Record<string, string>>
    readonly body: Uint8Array
}

export type HttpTransport = (request: HttpRequestData) => Promise<HttpResponseData>

/** Rebuilds a real body from the decomposed parts, for transports that fetch. */
export function toFetchBody(body: HttpBody | undefined): BodyInit | undefined {
    if (body === undefined) {
        return undefined
    }

    if (body.kind === 'text') {
        return body.text
    }

    const form = new FormData()
    for (const part of body.parts) {
        if (part.kind === 'field') {
            form.set(part.name, part.value)
        } else {
            form.append(
                part.name,
                new File([part.bytes as BlobPart], part.filename, { type: part.contentType }),
            )
        }
    }

    return form
}

/** The no-shell default: plain `fetch`, subject to whatever CORS allows. */
const fetchTransport: HttpTransport = async (request) => {
    const headers = new Headers(request.headers)
    if (request.body?.kind === 'text') {
        headers.set('Content-Type', request.body.contentType)
    }

    const body = toFetchBody(request.body)
    const response = await fetch(request.url, {
        method: request.method,
        headers,
        ...(body === undefined ? {} : { body }),
    })

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, name) => {
        responseHeaders[name] = value
    })

    return {
        status: response.status,
        headers: responseHeaders,
        body: new Uint8Array(await response.arrayBuffer()),
    }
}

let transport: HttpTransport = fetchTransport

/** Called once at mount by shells that bring their own network path. */
export function setHttpTransport(next: HttpTransport | undefined): void {
    transport = next ?? fetchTransport
}

async function toFormParts(form: FormData): Promise<readonly HttpFormPart[]> {
    const parts: HttpFormPart[] = []

    for (const [name, value] of form.entries()) {
        if (typeof value === 'string') {
            parts.push({ kind: 'field', name, value })
        } else {
            parts.push({
                kind: 'file',
                name,
                filename: value.name,
                contentType: value.type || 'application/octet-stream',
                bytes: new Uint8Array(await value.arrayBuffer()),
            })
        }
    }

    return parts
}

export interface HttpFetchInit {
    readonly method?: string
    readonly headers?: Readonly<Record<string, string>>
    /** A JSON-able body is sent as JSON text; FormData is sent as multipart. */
    readonly json?: unknown
    readonly form?: FormData
}

/** Statuses whose `Response` may not carry a body, per the constructor. */
const BODYLESS_STATUSES = new Set([204, 205, 304])

async function normalizeBody(init: HttpFetchInit): Promise<HttpBody | undefined> {
    if (init.json !== undefined) {
        return { kind: 'text', text: JSON.stringify(init.json), contentType: 'application/json' }
    }

    if (init.form !== undefined) {
        return { kind: 'form', parts: await toFormParts(init.form) }
    }

    return undefined
}

/**
 * `fetch`, routed through whatever transport the shell installed. Network
 * failures reject the way `fetch` does; HTTP errors resolve, again like
 * `fetch`, so callers keep their usual status handling.
 */
export async function httpFetch(url: string, init: HttpFetchInit = {}): Promise<Response> {
    const body = await normalizeBody(init)

    const headers: Record<string, string> = { ...init.headers }
    if (body?.kind === 'text') {
        headers['Content-Type'] = body.contentType
    }

    const data = await transport({
        url,
        method: init.method ?? (body === undefined ? 'GET' : 'POST'),
        headers,
        ...(body === undefined ? {} : { body }),
    })

    return new Response(
        BODYLESS_STATUSES.has(data.status) || data.body.length === 0
            ? null
            : (data.body as BodyInit),
        {
            status: data.status,
            headers: data.headers as Record<string, string>,
        },
    )
}
