/* eslint-disable import/max-dependencies -- Exercises the shared engine, catalog and persisted records together. */
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { IMAGE_MODELS, VIDEO_MODELS } from '../packages/ui/src/features/create/catalog'
import { estimateCost } from '../packages/ui/src/features/create/pricing'
import * as gallery from '../packages/ui/src/features/gallery/creations-db'
import { runGeneration } from '../packages/ui/src/features/generate/engine'
import type { GenerationApi } from '../packages/ui/src/features/generate/generation-context'
import { newJob } from '../packages/ui/src/features/generate/job'
import { launchRun } from '../packages/ui/src/features/generate/run'
import type { KeysApi } from '../packages/ui/src/features/keys/keys-context'
import type { LocalApiRequest } from '../packages/ui/src/features/local-api/contract'
import { parseImageRequest } from '../packages/ui/src/features/local-api/request'
import { serveLocalApi } from '../packages/ui/src/features/local-api/service'

vi.mock('../packages/ui/src/features/generate/engine', () => ({ runGeneration: vi.fn() }))

const effects = { adopt: vi.fn(), settle: vi.fn(), fail: vi.fn(), onPersisted: vi.fn() }
const credentials = vi.fn(() => Promise.resolve({ apiKey: 'private-provider-key' }))
const keys: KeysApi = {
    ready: true,
    connections: [],
    connectedProviders: new Set(IMAGE_MODELS.map((model) => model.provider)),
    credentials,
    connect: vi.fn(),
    remove: vi.fn(),
}
const generation: GenerationApi = {
    jobs: [],
    running: 0,
    completions: 0,
    clear: vi.fn(),
    clearFinished: vi.fn(),
    start: (input) => launchRun(newJob(input), input, credentials, effects),
}
const model =
    IMAGE_MODELS.find((candidate) => candidate.id === 'gpt-image-2.5-flare') ?? IMAGE_MODELS[0]
if (model === undefined) throw new Error('No image model in catalog')
const request = { model: model.id, prompt: 'A blue vase', count: 2 }

function call(action: LocalApiRequest['action'], body: unknown) {
    return serveLocalApi({ id: crypto.randomUUID(), action, body }, keys, generation)
}

/** jsdom's Blob lacks arrayBuffer; retain its FileReader support for recovery tests. */
function testImage(contents: string): Blob {
    const blob = new Blob([contents], { type: 'image/png' })
    blob.arrayBuffer = () =>
        Promise.resolve(new Uint8Array(new TextEncoder().encode(contents)).buffer)
    return blob
}

beforeEach(async () => {
    await gallery.clearCreations()
    URL.createObjectURL = vi.fn(() => 'blob:test-image')
    URL.revokeObjectURL = vi.fn()
    vi.mocked(runGeneration).mockResolvedValue([testImage('image bytes')])
})
afterEach(() => vi.restoreAllMocks())

test('the API returns every stored image field, app cost estimates, shortfalls and durable downloads', async () => {
    const response = await call('generate', request)
    const records = await gallery.listCreations()
    expect(records).toHaveLength(1)
    const record = records[0]
    if (record === undefined) throw new Error('Missing generated record')
    const { image, ...metadata } = record
    const parsed = await parseImageRequest(request)
    const perImage = estimateCost(parsed.model, { ...parsed.settings, outputCount: 1 })
    expect(response).toMatchObject({
        status: 200,
        body: {
            status: 'done',
            prompt: request.prompt,
            count: 2,
            persisted: true,
            currency: 'USD',
            estimatedCost: perImage,
            estimatedTotalCost: perImage,
            requestedEstimatedCost: perImage === null ? null : perImage * 2,
            actualCost: null,
            failures: [expect.any(String)],
            outputs: [
                {
                    ...metadata,
                    mediaType: image.type,
                    sizeBytes: image.size,
                    downloadUrl: `/v1/images/${record.id}/file`,
                },
            ],
        },
    })
    expect(JSON.stringify(response)).not.toContain('private-provider-key')
    expect(JSON.stringify(response)).not.toContain('blob:')
    expect(await gallery.listUsage()).toMatchObject([{ id: record.id, estimatedCost: perImage }])
    expect(await call('image', record.id)).toMatchObject({ status: 200, body: metadata })
    const file = await call('file', record.id)
    expect(file).toMatchObject({ status: 200, mediaType: 'image/png' })
    if (!('bytes' in file)) throw new Error('Expected image bytes')
    expect(Array.from(file.bytes)).toEqual(Array.from(new TextEncoder().encode('image bytes')))
    await gallery.deleteCreations([record.id])
    expect(await call('image', record.id)).toMatchObject({ status: 404 })
})

test('catalog and estimates use current capabilities, exclude videos and never contact a provider', async () => {
    vi.mocked(runGeneration).mockClear()
    const catalog = await call('models', null)
    expect(catalog).toMatchObject({
        status: 200,
        body: {
            data: IMAGE_MODELS.map((entry) =>
                expect.objectContaining({ id: entry.id, connected: true, kind: 'image' }),
            ),
        },
    })
    expect(await call('estimate', request)).toMatchObject({
        status: 200,
        body: { currency: 'USD', actualCost: null },
    })
    expect(await call('estimate', { ...request, quality: 'auto' })).toMatchObject({
        status: 200,
        body: { estimatedCost: null, estimatedTotalCost: null },
    })
    expect(runGeneration).not.toHaveBeenCalled()
})

test.each([
    { model: VIDEO_MODELS[0]?.id },
    { quality: 'not-a-tier' },
    { resolution: '8K' },
    { aspectRatio: '7:1' },
    { count: 5 },
    { durationSeconds: 8 },
    { prompt: '   ' },
    { references: [{ mediaType: 'image/png', base64: 'not base64!' }] },
    { references: [{ url: 'https://example.com/private.png' }] },
])('invalid image request %j is rejected before a paid call', async (override) => {
    vi.mocked(runGeneration).mockClear()
    expect(await call('generate', { ...request, ...override })).toMatchObject({ status: 400 })
    expect(runGeneration).not.toHaveBeenCalled()
})

test('references use the same files and first-image ratio rules as the composer', async () => {
    const close = vi.fn()
    vi.stubGlobal(
        'createImageBitmap',
        vi.fn(() => Promise.resolve({ width: 1200, height: 800, close })),
    )
    const input = await parseImageRequest({
        ...request,
        aspectRatio: 'first-image',
        references: [{ mediaType: 'image/png', base64: 'aW1hZ2U=' }],
    })
    expect(input.settings.aspectRatio).toBe('3:2')
    expect(input.references[0]).toBeInstanceOf(File)
    expect(input.references[0]?.type).toBe('image/png')
    expect(close).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
})

test('missing connections and video records cannot enter the image API', async () => {
    const disconnected = { ...keys, connectedProviders: new Set<string>() }
    expect(
        await serveLocalApi(
            { id: 'job', action: 'generate', body: request },
            disconnected,
            generation,
        ),
    ).toMatchObject({ status: 409 })
    await gallery.saveCreations([
        {
            id: 'video',
            kind: 'video',
            modelId: 'video',
            modelName: 'Video',
            providerId: 'openai',
            prompt: 'A clip',
            ratio: '1:1',
            createdAt: 1,
            image: testImage('video'),
        },
    ])
    expect(await call('file', 'video')).toMatchObject({ status: 404 })
})

test('a storage failure returns the paid image inline and reports that it was not saved', async () => {
    vi.spyOn(gallery, 'saveCreations').mockRejectedValueOnce(new Error('Quota exceeded'))
    vi.mocked(runGeneration).mockResolvedValueOnce([
        new Blob(['recover me'], { type: 'image/png' }),
    ])
    const response = await call('generate', { ...request, count: 1 })
    expect(response).toMatchObject({
        status: 200,
        body: { persisted: false, outputs: [{ downloadUrl: null, base64: btoa('recover me') }] },
    })
})
