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
import type { LocalApiKind } from '../packages/ui/src/features/local-api/contract'
import { parseImageRequest, parseVideoRequest } from '../packages/ui/src/features/local-api/request'
import { serveLocalApi } from '../packages/ui/src/features/local-api/service'

vi.mock('../packages/ui/src/features/generate/engine', () => ({ runGeneration: vi.fn() }))

const effects = { adopt: vi.fn(), settle: vi.fn(), fail: vi.fn(), onPersisted: vi.fn() }
const credentials = vi.fn(() => Promise.resolve({ apiKey: 'private-provider-key' }))
const keys: KeysApi = {
    ready: true,
    connections: [],
    connectedProviders: new Set(
        [...IMAGE_MODELS, ...VIDEO_MODELS].map((candidate) => candidate.provider),
    ),
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
/** A video model with fixed durations and an end frame, so every video control applies. */
const videoModel = VIDEO_MODELS.find(
    (candidate) => candidate.durations.kind !== 'automatic' && candidate.assets.lastFrame,
)
if (videoModel === undefined) throw new Error('No video model with fixed durations')
const videoRequest = { model: videoModel.id, prompt: 'A vase turning slowly' }
const frame = { mediaType: 'image/png', base64: 'aW1hZ2U=' }

function call(
    action: 'estimate' | 'generate' | 'read' | 'file',
    body: unknown,
    kind: LocalApiKind = 'image',
) {
    return serveLocalApi({ id: crypto.randomUUID(), action, kind, body }, keys, generation)
}

function models(kinds: readonly LocalApiKind[]) {
    return serveLocalApi(
        { id: crypto.randomUUID(), action: 'models', body: { kinds } },
        keys,
        generation,
    )
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
    expect(await call('read', record.id)).toMatchObject({ status: 200, body: metadata })
    const file = await call('file', record.id)
    expect(file).toMatchObject({ status: 200, mediaType: 'image/png' })
    if (!('bytes' in file)) throw new Error('Expected image bytes')
    expect(Array.from(file.bytes)).toEqual(Array.from(new TextEncoder().encode('image bytes')))
    await gallery.deleteCreations([record.id])
    expect(await call('read', record.id)).toMatchObject({ status: 404 })
})

test('catalog and estimates use current capabilities, list only allowed kinds and never contact a provider', async () => {
    vi.mocked(runGeneration).mockClear()
    expect(await models(['image'])).toMatchObject({
        status: 200,
        body: {
            data: IMAGE_MODELS.map((entry) =>
                expect.objectContaining({ id: entry.id, connected: true, kind: 'image' }),
            ),
        },
    })
    expect(await models(['video'])).toMatchObject({
        status: 200,
        body: {
            data: VIDEO_MODELS.map((entry) =>
                expect.objectContaining({ id: entry.id, connected: true, kind: 'video' }),
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
    expect(await call('estimate', videoRequest, 'video')).toMatchObject({
        status: 200,
        body: { currency: 'USD', settings: { modelId: videoModel.id } },
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

test.each([
    { model: model.id },
    { resolution: '8K' },
    { aspectRatio: 'first-image' },
    { durationSeconds: 999 },
    { count: 2 },
    { lastFrame: frame },
    { prompt: '   ' },
])('invalid video request %j is rejected before a paid call', async (override) => {
    vi.mocked(runGeneration).mockClear()
    expect(await call('generate', { ...videoRequest, ...override }, 'video')).toMatchObject({
        status: 400,
    })
    expect(runGeneration).not.toHaveBeenCalled()
})

test('a model that picks its own clip length refuses durationSeconds', () => {
    const automatic = VIDEO_MODELS.find((candidate) => candidate.durations.kind === 'automatic')
    if (automatic === undefined) return
    expect(() =>
        parseVideoRequest({ model: automatic.id, prompt: 'A clip', durationSeconds: 8 }),
    ).toThrow('picks its own clip length')
})

test('video frames map to the composer slots and clips download from the video routes', async () => {
    const input = parseVideoRequest({ ...videoRequest, firstFrame: frame, lastFrame: frame })
    expect(input.firstFrame).toBeInstanceOf(File)
    expect(input.lastFrame).toBeInstanceOf(File)
    const clip = new Blob(['clip bytes'], { type: 'video/mp4' })
    clip.arrayBuffer = () =>
        Promise.resolve(new Uint8Array(new TextEncoder().encode('clip bytes')).buffer)
    vi.mocked(runGeneration).mockResolvedValueOnce([clip])
    const response = await call('generate', videoRequest, 'video')
    const [record] = await gallery.listCreations()
    if (record === undefined) throw new Error('Missing generated clip')
    expect(response).toMatchObject({
        status: 200,
        body: {
            kind: 'video',
            outputs: [
                {
                    id: record.id,
                    kind: 'video',
                    mediaType: 'video/mp4',
                    downloadUrl: `/v1/videos/${record.id}/file`,
                },
            ],
        },
    })
    expect(await call('file', record.id, 'video')).toMatchObject({
        status: 200,
        mediaType: 'video/mp4',
    })
    expect(await call('read', record.id, 'image')).toMatchObject({ status: 404 })
})

test('missing connections and video records cannot enter the image API', async () => {
    const disconnected = { ...keys, connectedProviders: new Set<string>() }
    expect(
        await serveLocalApi(
            { id: 'job', action: 'generate', kind: 'image', body: request },
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
