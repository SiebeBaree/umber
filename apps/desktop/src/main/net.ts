import { ipcMain, net } from 'electron'

import {
    NET_CHANNEL,
    type NetBodyDto,
    type NetRequestDto,
    type NetResponseDto,
} from '../shared/bridge'
import { rendererOnly } from './ipc-guard'
import { proxyVerdictFor } from './security'

/**
 * The renderer's road to provider APIs.
 *
 * Provider endpoints rarely send CORS headers, so the sandboxed renderer
 * cannot call them itself; requests cross IPC as plain data and are performed
 * here with Chromium's network stack, where CORS does not apply. The proxy is
 * deliberately not general-purpose: `proxyVerdictFor` pins full requests to
 * the named provider hosts and strips everything but the method off the rest.
 */

function toFetchBody(body: NetBodyDto | undefined): string | FormData | undefined {
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
                new File([part.bytes], part.filename, { type: part.contentType }),
            )
        }
    }

    return form
}

function cleanHeaders(headers: unknown): Record<string, string> {
    if (typeof headers !== 'object' || headers === null) {
        return {}
    }

    const clean: Record<string, string> = {}
    for (const [name, value] of Object.entries(headers)) {
        if (typeof value === 'string') {
            clean[name] = value
        }
    }

    return clean
}

async function handleFetch(request: NetRequestDto): Promise<NetResponseDto> {
    const method = typeof request.method === 'string' ? request.method : 'GET'
    const verdict = proxyVerdictFor(request.url, method)

    if (verdict === 'refuse') {
        throw new Error(`Refused to proxy ${method} ${request.url}`)
    }

    const headers = new Headers(verdict === 'full' ? cleanHeaders(request.headers) : {})
    if (request.body?.kind === 'text') {
        headers.set('Content-Type', request.body.contentType)
    }

    const body = toFetchBody(verdict === 'full' ? request.body : undefined)
    const response = await net.fetch(request.url, {
        method,
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

export function registerNetIpc(): void {
    ipcMain.handle(
        NET_CHANNEL,
        rendererOnly((request: NetRequestDto) => handleFetch(request)),
    )
}
