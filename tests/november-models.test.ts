// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest'

import { runGeneration } from '../packages/ui/src/features/generate/engine'
import { httpFetch } from '../packages/ui/src/lib/http'
import { modelRequest, referenceImage } from './model-request'

/** Ideogram 4.6, Kling Image 4.0, Seedream 5.5 and the new 4K video tiers. */

vi.mock('../packages/ui/src/lib/http', () => ({ httpFetch: vi.fn() }))
const url = 'https://results.example/image.png'
const b64 = 'aW1hZ2U='

beforeEach(() => {
    vi.mocked(httpFetch).mockReset()
    vi.mocked(httpFetch).mockImplementation(() => Promise.resolve(new Response('image')))
})

test('Ideogram 4.6 sends an exact 4K size to its own v2 endpoint', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(Response.json({ data: [{ url }, { url }] }))
    const images = await runGeneration(
        modelRequest('ideogram-v4-6', {
            ratio: '16:9',
            resolution: '4K',
            quality: 'high',
            count: 2,
            references: [referenceImage()],
        }),
    )
    expect(images).toHaveLength(2)
    const [address, options] = vi.mocked(httpFetch).mock.calls[0] ?? []
    expect(address).toBe('https://api.ideogram.ai/v2/image/generate/ideogram-4-6')
    expect(options?.form?.get('size')).toBe('5440x3072')
    expect(options?.form?.get('quality')).toBe('high')
    expect(options?.form?.get('num_images')).toBe('2')
    expect(options?.form?.get('images')).toBeInstanceOf(File)
})

test.each([
    ['1K', '1:1', '1024x1024'],
    ['2K', '21:9', '3104x1344'],
    ['4K', '9:16', '3072x5440'],
] as const)('Ideogram 4.6 keeps %s %s within its size limits', async (resolution, ratio, size) => {
    vi.mocked(httpFetch).mockResolvedValueOnce(Response.json({ data: [{ url }] }))
    await runGeneration(modelRequest('ideogram-v4-6', { resolution, ratio }))
    const [width, height] = size.split('x').map(Number)
    expect(vi.mocked(httpFetch).mock.calls[0]?.[1]?.form?.get('size')).toBe(size)
    // Ideogram bills by resolved pixels, so a tier must stay inside its square.
    const edge = { '1K': 1024, '2K': 2048, '4K': 4096 }[resolution]
    expect((width ?? 0) * (height ?? 0)).toBeLessThanOrEqual(edge ** 2)
    expect((width ?? 0) % 32).toBe(0)
    expect((height ?? 0) % 32).toBe(0)
})

test.each([
    ['ideogram-v4-6', '2K', '3600:600', '4992x832'],
    ['ideogram-v4-6', '2K', '600:3600', '832x4992'],
    ['ideogram-v4-6', '4K', '3600:600', '8064x1344'],
    ['ideogram-v4-5', '2K', '3600:600', '4992x832'],
    ['ideogram-v4-6', '2K', '16:9', '2720x1536'],
] as const)('%s keeps a %s %s first image within 6:1', async (modelId, resolution, ratio, size) => {
    vi.mocked(httpFetch).mockResolvedValueOnce(Response.json({ data: [{ url }] }))
    await runGeneration(modelRequest(modelId, { resolution, ratio }))
    expect(vi.mocked(httpFetch).mock.calls[0]?.[1]?.form?.get('size')).toBe(size)
})

test('Kling Image 4.0 creates one API 2.0 task with named references', async () => {
    vi.mocked(httpFetch)
        .mockResolvedValueOnce(Response.json({ code: 0, data: { id: 'task' } }))
        .mockResolvedValueOnce(
            Response.json({
                code: 0,
                data: [
                    {
                        status: 'succeeded',
                        outputs: [
                            { type: 'image', url },
                            { type: 'image', url },
                        ],
                    },
                ],
            }),
        )
    const images = await runGeneration(
        modelRequest('kling-image-4', {
            count: 2,
            ratio: '21:9',
            resolution: '8K',
            references: [referenceImage(), referenceImage()],
        }),
    )
    expect(images).toHaveLength(2)
    const create = vi.mocked(httpFetch).mock.calls[0]
    expect(create?.[0]).toBe('https://api-singapore.klingai.com/image-generation/kling-4.0')
    expect(create?.[1]).toMatchObject({ headers: { Authorization: 'Bearer test-key' } })
    expect(create?.[1]?.json).toEqual({
        contents: [
            { type: 'prompt', text: 'A lighthouse' },
            { type: 'refer_image', id: 'image1', url: btoa('reference') },
            { type: 'refer_image', id: 'image2', url: btoa('reference') },
        ],
        settings: { result_type: 'single', n: 2, resolution: '8k', aspect_ratio: '21:9' },
    })
    expect(vi.mocked(httpFetch).mock.calls[1]?.[0]).toBe(
        'https://api-singapore.klingai.com/tasks?task_ids=task',
    )
    expect(httpFetch).toHaveBeenLastCalledWith(url, {})
})

test('Kling Image 4.0 refuses the legacy key pair and extra references before sending', async () => {
    await expect(
        runGeneration(
            modelRequest('kling-image-4', { credentials: { accessKey: 'a', secretKey: 'b' } }),
        ),
    ).rejects.toThrow('need an API key')
    await expect(
        runGeneration(
            modelRequest('kling-image-4', {
                references: Array.from({ length: 11 }, referenceImage),
            }),
        ),
    ).rejects.toThrow('up to 10 reference images')
    expect(httpFetch).not.toHaveBeenCalled()
})

test('Seedream 5.5 sends its dated ID, an exact size and no batch switch', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(Response.json({ data: [{ b64_json: b64 }] }))
    const images = await runGeneration(
        modelRequest('seedream-5-5', {
            ratio: '16:9',
            resolution: '2K',
            references: [referenceImage()],
        }),
    )
    expect(images[0]?.type).toBe('image/png')
    const payload = vi.mocked(httpFetch).mock.calls[0]?.[1]?.json
    expect(payload).toMatchObject({
        model: 'dola-seedream-5-5-261028',
        size: '2816x1584',
        watermark: false,
        image: `data:image/png;base64,${btoa('reference')}`,
    })
    expect(payload).not.toHaveProperty('sequential_image_generation')
})

test.each([
    ['kling-4-0', '4K', '4k'],
    ['seedance-2-5', '4K', '4k'],
    ['seedance-2-5', '1080p', '1080p'],
])('%s sends the %s tier in the provider spelling', async (modelId, resolution, wire) => {
    const kling = modelId.startsWith('kling')
    vi.mocked(httpFetch)
        .mockResolvedValueOnce(
            Response.json(kling ? { code: 0, data: { id: 'task' } } : { id: 'task' }),
        )
        .mockResolvedValueOnce(
            Response.json(
                kling
                    ? {
                          code: 0,
                          data: [{ status: 'succeeded', outputs: [{ type: 'video', url }] }],
                      }
                    : { status: 'succeeded', content: { video_url: url } },
            ),
        )
    await runGeneration(modelRequest(modelId, { resolution }))
    const payload = vi.mocked(httpFetch).mock.calls[0]?.[1]?.json
    expect(payload).toMatchObject(kling ? { settings: { resolution: wire } } : { resolution: wire })
})
