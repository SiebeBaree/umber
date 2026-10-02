// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'

import { afterEach, expect, test, vi } from 'vitest'

import { LocalApiServer } from '../apps/desktop/src/main/local-api/server'
import type { LocalApiResponse } from '../packages/ui/src/features/local-api/contract'

const servers: LocalApiServer[] = []

async function start(
    dispatch = vi.fn((): Promise<LocalApiResponse> =>
        Promise.resolve({ status: 200, body: { ok: true } }),
    ),
) {
    const server = new LocalApiServer({
        port: 0,
        docs: await readFile('docs/LOCAL_API.md', 'utf8'),
        dispatch,
    })
    servers.push(server)
    const port = await server.start()
    return { server, base: `http://127.0.0.1:${port}`, dispatch }
}

function submit(base: string, key = 'request-1', body?: { model: string; prompt: string }) {
    return fetch(`${base}/v1/images/generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(body ?? { model: 'test', prompt: 'A vase' }),
    })
}

function foreignHostStatus(base: string): Promise<number | undefined> {
    return new Promise((resolve, reject) => {
        const request = httpRequest(
            `${base}/v1/models`,
            { headers: { Host: 'example.com' } },
            (response) => {
                response.resume()
                resolve(response.statusCode)
            },
        )
        request.on('error', reject)
        request.end()
    })
}

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.stop()))
})

test('serves documentation, models and estimates to local clients while rejecting browser origins and foreign hosts', async () => {
    const { base, dispatch } = await start()
    const docs = await fetch(`${base}/llms.txt`)
    expect(docs.headers.get('content-type')).toContain('text/plain')
    expect(await docs.text()).toContain('estimatedTotalCost')
    expect(
        (
            await fetch(`${base}/v1/models`, {
                headers: { Origin: 'https://example.com' },
            })
        ).status,
    ).toBe(403)
    expect(await foreignHostStatus(base)).toBe(403)
    expect(dispatch).not.toHaveBeenCalled()
    expect((await fetch(`${base}/v1/models`)).status).toBe(200)
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ action: 'models' }))
    const estimate = await fetch(`${base}/v1/images/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'test', prompt: 'A vase' }),
    })
    expect(estimate.status).toBe(200)
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'estimate' }))
})

test('a retried submission runs once, polls to completion and can still be read after toggling the listener', async () => {
    let finish: ((response: LocalApiResponse) => void) | undefined
    const pending = new Promise<LocalApiResponse>((resolve) => {
        finish = resolve
    })
    const { base, dispatch, server } = await start(vi.fn(() => pending))
    const initial = await submit(base)
    expect(initial.status).toBe(202)
    const job = await initial.json()
    expect(job.status).toBe('running')
    expect(await (await submit(base)).json()).toEqual(job)
    expect((await submit(base, 'request-1', { model: 'test', prompt: 'Different' })).status).toBe(
        409,
    )
    expect((await submit(base, 'request-2')).status).toBe(429)
    expect(dispatch).toHaveBeenCalledTimes(1)
    if (finish === undefined) throw new Error('Missing pending request')
    finish({ status: 200, body: { outputs: [{ id: 'saved-image' }], estimatedCost: 0.1 } })
    await vi.waitFor(async () => {
        expect(await (await fetch(`${base}${job.pollUrl}`)).json()).toMatchObject({
            status: 'succeeded',
            result: { estimatedCost: 0.1 },
        })
    })
    await server.stop()
    await expect(fetch(`${base}/llms.txt`)).rejects.toThrow()
    const port = await server.start()
    expect(await (await fetch(`http://127.0.0.1:${port}${job.pollUrl}`)).json()).toMatchObject({
        status: 'succeeded',
    })
})

test('returns structured failed jobs and requires JSON and idempotency keys before dispatch', async () => {
    const { base, dispatch } = await start(
        vi.fn(() =>
            Promise.resolve({ status: 400, body: { error: { code: 'unknown_image_model' } } }),
        ),
    )
    expect(
        (
            await fetch(`${base}/v1/images/generations`, {
                method: 'POST',
                body: '{}',
            })
        ).status,
    ).toBe(415)
    expect(
        (
            await fetch(`${base}/v1/images/generations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{',
            })
        ).status,
    ).toBe(400)
    expect((await submit(base, '')).status).toBe(400)
    expect(dispatch).not.toHaveBeenCalled()
    const job = await (await submit(base)).json()
    await vi.waitFor(async () => {
        expect(await (await fetch(`${base}${job.pollUrl}`)).json()).toMatchObject({
            status: 'failed',
            resultStatus: 400,
            result: { error: { code: 'unknown_image_model' } },
        })
    })
    expect((await fetch(`${base}/v1/videos/generations`)).status).toBe(404)
})

test('returns original image bytes and media type without wrapping them in JSON', async () => {
    const { base, dispatch } = await start(
        vi.fn(() =>
            Promise.resolve({
                status: 200,
                bytes: new Uint8Array([1, 2, 3]),
                mediaType: 'image/png',
            }),
        ),
    )
    const file = await fetch(`${base}/v1/images/saved-image/file`)
    expect(file.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ action: 'file', body: 'saved-image' }),
    )
})
