// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest'

import { runGeneration } from '../packages/ui/src/features/generate/engine'
import { httpFetch } from '../packages/ui/src/lib/http'
import { modelRequest, referenceImage } from './model-request'

vi.mock('../packages/ui/src/lib/http', () => ({ httpFetch: vi.fn() }))
const url = 'https://results.example/video.mp4'

beforeEach(() => {
    vi.mocked(httpFetch).mockReset()
    vi.mocked(httpFetch).mockResolvedValue(
        new Response('video', { headers: { 'Content-Type': 'video/mp4' } }),
    )
})

test.each([
    ['wan-3', 'wan3.0-video'],
    ['wan-3-prime', 'wan3.0-video-prime'],
])('%s submits and polls through the regional workspace endpoint', async (modelId, wireId) => {
    vi.mocked(httpFetch)
        .mockResolvedValueOnce(Response.json({ output: { task_id: 'task' } }))
        .mockResolvedValueOnce(
            Response.json({ output: { task_status: 'SUCCEEDED', video_url: url } }),
        )
    const videos = await runGeneration(
        modelRequest(modelId, {
            credentials: { apiKey: 'test-key', workspaceId: 'workspace-123', region: 'china' },
            references: [referenceImage()],
            durationSeconds: 30,
        }),
    )
    expect(videos[0]?.type).toBe('video/mp4')
    const create = vi.mocked(httpFetch).mock.calls[0]
    expect(create?.[0]).toBe(
        'https://workspace-123.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
    )
    expect(create?.[1]?.json).toMatchObject({
        model: wireId,
        input: {
            media: [{ type: 'reference_image', url: expect.stringContaining('data:image/png') }],
        },
        parameters: { duration: 30, resolution: '480P', audio: true },
    })
    expect(vi.mocked(httpFetch).mock.calls[1]?.[0]).toBe(
        'https://workspace-123.cn-beijing.maas.aliyuncs.com/api/v1/tasks/task',
    )
})

test.each(['wan-3', 'minimax-h3-max'])(
    '%s rejects mixing frames with reference images before sending a request',
    async (modelId) => {
        await expect(
            runGeneration(
                modelRequest(modelId, {
                    firstFrame: referenceImage(),
                    references: [referenceImage()],
                }),
            ),
        ).rejects.toThrow(/either frames|either.*reference/iu)
        expect(httpFetch).not.toHaveBeenCalled()
    },
)

test.each([
    ['kling-3-0-turbo', 'image-to-video/kling-3.0-turbo'],
    ['kling-3-0-omni', 'omni-video/kling-3.0-omni'],
])('%s creates and retrieves an API 2.0 task', async (modelId, endpoint) => {
    vi.mocked(httpFetch)
        .mockResolvedValueOnce(Response.json({ code: 0, data: { id: 'task' } }))
        .mockResolvedValueOnce(
            Response.json({
                code: 0,
                data: [{ status: 'succeeded', outputs: [{ type: 'video', url }] }],
            }),
        )
    await runGeneration(modelRequest(modelId, { firstFrame: referenceImage() }))
    const create = vi.mocked(httpFetch).mock.calls[0]
    expect(create?.[0]).toBe(`https://api-singapore.klingai.com/${endpoint}`)
    expect(create?.[1]?.json).toMatchObject({
        contents: [
            { type: 'prompt', text: 'A lighthouse' },
            { type: 'first_frame', url: btoa('reference') },
        ],
    })
    if (modelId.endsWith('turbo')) {
        expect(create?.[1]?.json).not.toHaveProperty('settings.audio')
        expect(create?.[1]?.json).not.toHaveProperty('settings.multi_shot')
    }
    expect(vi.mocked(httpFetch).mock.calls[1]?.[0]).toContain('/tasks?task_ids=task')
})

test('Kling Omni enforces the combined seven-image limit', async () => {
    await expect(
        runGeneration(
            modelRequest('kling-3-0-omni', {
                firstFrame: referenceImage(),
                references: Array.from({ length: 7 }, referenceImage),
            }),
        ),
    ).rejects.toThrow('seven images')
    expect(httpFetch).not.toHaveBeenCalled()
})

test('Veo Lite uses its own model and operation response', async () => {
    vi.mocked(httpFetch)
        .mockResolvedValueOnce(Response.json({ name: 'operations/task' }))
        .mockResolvedValueOnce(
            Response.json({
                done: true,
                response: {
                    generateVideoResponse: { generatedSamples: [{ video: { uri: url } }] },
                },
            }),
        )
    await runGeneration(modelRequest('veo-3-1-lite'))
    expect(vi.mocked(httpFetch).mock.calls[0]?.[0]).toContain(
        '/models/veo-3.1-lite-generate-preview:predictLongRunning',
    )
    expect(vi.mocked(httpFetch).mock.calls[0]?.[1]?.json).toMatchObject({
        parameters: { resolution: '720p', durationSeconds: '8' },
    })
})

test('Omni 1.1 assigns independent reference tags and lets the model choose duration', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
        Response.json({ steps: [{ content: [{ type: 'video', uri: url }] }] }),
    )
    await runGeneration(
        modelRequest('gemini-omni-flash', {
            resolution: '4K',
            firstFrame: referenceImage(),
            references: [referenceImage()],
        }),
    )
    expect(vi.mocked(httpFetch).mock.calls[0]?.[1]?.json).toMatchObject({
        model: 'gemini-omni-1.1-flash',
        response_format: { type: 'video', resolution: '4k', delivery: 'uri' },
        input: [
            { type: 'image' },
            { type: 'image' },
            {
                type: 'text',
                text: expect.stringContaining(
                    '[# Sources <FIRST_FRAME>@Image1] [# References <IMAGE_REF_0>@Image2]',
                ),
            },
        ],
    })
    expect(vi.mocked(httpFetch).mock.calls[0]?.[1]?.json).not.toHaveProperty('duration')
})

test.each([
    [
        'seedance-2-0-fast',
        'dreamina-seedance-2-0-fast-260128',
        { id: 'task' },
        { status: 'succeeded', content: { video_url: url } },
    ],
    [
        'minimax-h3-max',
        'MiniMax-H3-Max',
        { task_id: 'task' },
        { task: { status: 'succeeded', content: { url } } },
    ],
    [
        'grok-imagine-video-1-5-lite',
        'grok-imagine-video-1.5-lite',
        { request_id: 'task' },
        { status: 'done', video: { url } },
    ],
])(
    '%s uses its new model ID and returns the finished clip',
    async (modelId, wireId, created, finished) => {
        vi.mocked(httpFetch)
            .mockResolvedValueOnce(Response.json(created))
            .mockResolvedValueOnce(Response.json(finished))
        const videos = await runGeneration(modelRequest(modelId))
        expect(videos[0]?.type).toBe('video/mp4')
        expect(vi.mocked(httpFetch).mock.calls[0]?.[1]?.json).toMatchObject({ model: wireId })
        expect(httpFetch).toHaveBeenLastCalledWith(url, {})
    },
)
