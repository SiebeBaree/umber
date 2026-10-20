// @vitest-environment node
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, expect, test, vi } from 'vitest'

import type { Dispatch } from '../apps/desktop/src/main/local-api/jobs'
import { LocalApiServer } from '../apps/desktop/src/main/local-api/server'
import { SpendLedger } from '../apps/desktop/src/main/local-api/spend'
import type {
    LocalApiRequest,
    LocalApiResponse,
    LocalApiSettings,
} from '../packages/ui/src/features/local-api/contract'

const servers: LocalApiServer[] = []
const directories: string[] = []

/** Prices every request at `cost` and hands generation to `generate`. */
function renderer(
    generate: (request: LocalApiRequest) => Promise<LocalApiResponse> = () =>
        Promise.resolve({ status: 200, body: { ok: true } }),
    cost: number | null = 0.1,
) {
    return vi.fn<Dispatch>((request) =>
        request.action === 'estimate'
            ? Promise.resolve({ status: 200, body: { estimatedTotalCost: cost } })
            : generate(request),
    )
}

async function start(dispatch = renderer(), overrides: Partial<LocalApiSettings> = {}) {
    const directory = await mkdtemp(join(tmpdir(), 'umber-server-test-'))
    directories.push(directory)
    const settings: LocalApiSettings = { enabled: true, access: 'both', limits: [], ...overrides }
    const ledger = await SpendLedger.open(join(directory, 'spend.json'))
    const settled = vi.fn()
    const server = new LocalApiServer({
        port: 0,
        docs: await readFile('docs/LOCAL_API.md', 'utf8'),
        dispatch,
        ledger,
        settings: () => settings,
        settled,
    })
    servers.push(server)
    const port = await server.start()
    return { server, base: `http://127.0.0.1:${port}`, dispatch, ledger, settled }
}

function submit(
    base: string,
    key = 'request-1',
    body?: { model: string; prompt: string },
    kind: 'images' | 'videos' = 'images',
) {
    return fetch(`${base}/v1/${kind}/generations`, {
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
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
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
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ action: 'models', body: { kinds: ['image', 'video'] } }),
    )
    const estimate = await fetch(`${base}/v1/images/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'test', prompt: 'A vase' }),
    })
    expect(estimate.status).toBe(200)
    expect(await estimate.json()).toMatchObject({ estimatedTotalCost: 0.1, limits: [] })
    expect(dispatch).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'estimate', kind: 'image' }),
    )
})

test('a retried submission runs once, polls to completion and can still be read after toggling the listener', async () => {
    let finish: ((response: LocalApiResponse) => void) | undefined
    const pending = new Promise<LocalApiResponse>((resolve) => {
        finish = resolve
    })
    const { base, dispatch, server } = await start(renderer(() => pending))
    const initial = await submit(base)
    expect(initial.status).toBe(202)
    const job = await initial.json()
    expect(job.status).toBe('running')
    expect(await (await submit(base)).json()).toEqual(job)
    expect((await submit(base, 'request-1', { model: 'test', prompt: 'Different' })).status).toBe(
        409,
    )
    expect((await submit(base, 'request-2')).status).toBe(429)
    // One estimate and one generation; retries, conflicts and the busy reply call neither.
    expect(dispatch).toHaveBeenCalledTimes(2)
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

test('answers invalid requests before any job exists and requires JSON and idempotency keys', async () => {
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
    const rejected = await submit(base)
    expect(rejected.status).toBe(400)
    expect(await rejected.json()).toMatchObject({ error: { code: 'unknown_image_model' } })
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ action: 'estimate' }),
    )
})

test('a generation that fails at the provider settles as a failed job and counts no spend', async () => {
    const { base, ledger, settled } = await start(
        renderer(() =>
            Promise.resolve({ status: 502, body: { error: { code: 'generation_failed' } } }),
        ),
    )
    const job = await (await submit(base)).json()
    await vi.waitFor(async () => {
        expect(await (await fetch(`${base}${job.pollUrl}`)).json()).toMatchObject({
            status: 'failed',
            resultStatus: 502,
        })
    })
    expect(settled).toHaveBeenCalledOnce()
    expect(ledger.spent(null)).toBe(0)
})

test('access settings gate each kind and the models list', async () => {
    const { base, dispatch } = await start(renderer(), { access: 'images' })
    const video = await fetch(`${base}/v1/videos/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
    })
    expect(video.status).toBe(403)
    expect(await video.json()).toMatchObject({ error: { code: 'feature_disabled' } })
    expect((await fetch(`${base}/v1/videos/saved/file`)).status).toBe(403)
    await fetch(`${base}/v1/models`)
    expect(dispatch).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ action: 'models', body: { kinds: ['image'] } }),
    )
})

test('an image and a video generation run side by side, one of each at a time', async () => {
    const pending = new Promise<LocalApiResponse>(() => {})
    const { base, dispatch } = await start(renderer(() => pending))
    expect((await submit(base, 'image-1')).status).toBe(202)
    expect((await submit(base, 'video-1', undefined, 'videos')).status).toBe(202)
    expect((await submit(base, 'video-2', undefined, 'videos')).status).toBe(429)
    expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'generate', kind: 'video' }),
    )
})

test('spending limits hold running estimates, record finished spend and report what is left', async () => {
    let finish: ((response: LocalApiResponse) => void) | undefined
    const pending = new Promise<LocalApiResponse>((resolve) => {
        finish = resolve
    })
    const { base, ledger } = await start(
        renderer(() => pending, 0.6),
        {
            limits: [{ usd: 1, days: 7 }],
        },
    )
    expect((await submit(base, 'image-1')).status).toBe(202)
    const blocked = await submit(base, 'video-1', undefined, 'videos')
    expect(blocked.status).toBe(402)
    expect(await blocked.json()).toMatchObject({ error: { code: 'spending_limit' } })
    if (finish === undefined) throw new Error('Missing pending request')
    finish({ status: 200, body: { estimatedTotalCost: 0.6 } })
    await vi.waitFor(() => expect(ledger.spent(7)).toBe(0.6))
    const estimate = await fetch(`${base}/v1/images/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'test', prompt: 'A vase' }),
    })
    expect(await estimate.json()).toMatchObject({
        limits: [{ usd: 1, days: 7, spent: 0.6, remaining: expect.closeTo(0.4) }],
    })
})

test('unpriced requests cannot run while any limit is set', async () => {
    const { base } = await start(renderer(undefined, null), { limits: [{ usd: 5, days: null }] })
    const response = await submit(base)
    expect(response.status).toBe(402)
    expect(await response.json()).toMatchObject({ error: { code: 'cost_unknown' } })
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
