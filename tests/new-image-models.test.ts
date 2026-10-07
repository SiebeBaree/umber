// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest'

import { runGeneration } from '../packages/ui/src/features/generate/engine'
import { httpFetch } from '../packages/ui/src/lib/http'
import { modelRequest, referenceImage } from './model-request'

vi.mock('../packages/ui/src/lib/http', () => ({ httpFetch: vi.fn() }))
const url = 'https://results.example/image.png'
const b64 = 'aW1hZ2U='

beforeEach(() => {
    vi.mocked(httpFetch).mockReset()
    vi.mocked(httpFetch).mockImplementation(() => Promise.resolve(new Response('image')))
})

test('Nano Banana 2.1 uses Interactions and decodes image output among text steps', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
        Response.json({
            steps: [
                { content: [{ type: 'text', text: 'Done' }] },
                { content: [{ type: 'image', data: b64, mime_type: 'image/png' }] },
            ],
        }),
    )
    const images = await runGeneration(
        modelRequest('nano-banana-2-1', {
            ratio: '16:9',
            resolution: '4K',
            references: [referenceImage()],
        }),
    )
    expect(await images[0]?.text()).toBe('image')
    expect(httpFetch).toHaveBeenCalledWith(expect.stringContaining('/interactions'), {
        headers: { 'x-goog-api-key': 'test-key' },
        json: {
            model: 'gemini-nano-banana-2.1',
            input: [
                { type: 'image', mime_type: 'image/png', data: btoa('reference') },
                { type: 'text', text: 'A lighthouse' },
            ],
            response_format: {
                type: 'image',
                mime_type: 'image/png',
                aspect_ratio: '16:9',
                image_size: '4K',
            },
        },
    })
})

test.each(['flux-3-image', 'flux-2-klein-4b', 'flux-2-klein-9b'])(
    '%s sends its own endpoint and reference format, polls and downloads',
    async (modelId) => {
        vi.mocked(httpFetch)
            .mockResolvedValueOnce(Response.json({ polling_url: 'https://api.bfl.ai/poll/task' }))
            .mockResolvedValueOnce(Response.json({ status: 'Ready', result: { sample: url } }))
        const images = await runGeneration(
            modelRequest(modelId, { references: [referenceImage()], resolution: '2K' }),
        )
        const payload = vi.mocked(httpFetch).mock.calls[0]?.[1]?.json
        expect(vi.mocked(httpFetch).mock.calls[0]?.[0]).toBe(`https://api.bfl.ai/v1/${modelId}`)
        expect(payload).toMatchObject(
            modelId === 'flux-3-image'
                ? { images: [btoa('reference')], resolution: '2k', aspect_ratio: '1:1' }
                : { input_image: btoa('reference'), width: 2048, height: 2048 },
        )
        expect(images[0]?.type).toBe('text/plain;charset=utf-8')
        expect(httpFetch).toHaveBeenLastCalledWith(url, {})
    },
)

test.each([
    ['qwen-image-3', 'qwen-image-3.0'],
    ['wan-2-7-image', 'wan2.7-image'],
    ['wan-2-7-image-pro', 'wan2.7-image-pro'],
])('%s preserves reference images and native output count', async (modelId, wireId) => {
    vi.mocked(httpFetch).mockResolvedValueOnce(
        Response.json({
            output: { choices: [{ message: { content: [{ image: url }, { image: url }] } }] },
        }),
    )
    const images = await runGeneration(
        modelRequest(modelId, { count: 2, references: [referenceImage()] }),
    )
    expect(images).toHaveLength(2)
    expect(vi.mocked(httpFetch).mock.calls[0]?.[1]?.json).toMatchObject({
        model: wireId,
        input: {
            messages: [
                {
                    role: 'user',
                    content: [
                        { image: `data:image/png;base64,${btoa('reference')}` },
                        { text: 'A lighthouse' },
                    ],
                },
            ],
        },
        parameters: { n: 2, watermark: false },
    })
    if (modelId.startsWith('wan')) {
        expect(vi.mocked(httpFetch).mock.calls[0]?.[0]).toContain(
            'workspace-123.ap-southeast-1.maas.aliyuncs.com',
        )
        expect(vi.mocked(httpFetch).mock.calls[0]?.[1]?.json).toMatchObject({
            parameters: { enable_sequential: false },
        })
    }
})

test('Wan rejects missing workspace and unsupported 4K editing before charging', async () => {
    await expect(
        runGeneration(modelRequest('wan-2-7-image', { credentials: { apiKey: 'test-key' } })),
    ).rejects.toThrow('workspace ID')
    await expect(
        runGeneration(
            modelRequest('wan-2-7-image-pro', { resolution: '4K', references: [referenceImage()] }),
        ),
    ).rejects.toThrow('up to 2K')
    expect(httpFetch).not.toHaveBeenCalled()
})

test('Z-Image uses one call per output without paid prompt expansion', async () => {
    vi.mocked(httpFetch).mockImplementation((address) =>
        Promise.resolve(
            address === url
                ? new Response('image')
                : Response.json({
                      output: { choices: [{ message: { content: [{ image: url }] } }] },
                  }),
        ),
    )
    const images = await runGeneration(modelRequest('z-image-turbo', { count: 2 }))
    expect(images).toHaveLength(2)
    const creates = vi.mocked(httpFetch).mock.calls.filter(([address]) => address !== url)
    expect(creates).toHaveLength(2)
    expect(creates[0]?.[1]?.json).toMatchObject({
        model: 'z-image-turbo',
        parameters: { prompt_extend: false, size: '1024*1024' },
    })
})

test.each([
    ['kling-image-3', 'kling-v3', 'generations'],
    ['kling-image-3-omni', 'kling-v3-omni', 'omni-image'],
])('%s uses the correct create and query endpoints', async (modelId, wireId, endpoint) => {
    vi.mocked(httpFetch)
        .mockResolvedValueOnce(Response.json({ code: 0, data: { task_id: 'task' } }))
        .mockResolvedValueOnce(
            Response.json({
                code: 0,
                data: { task_status: 'succeed', task_result: { images: [{ url }] } },
            }),
        )
    await runGeneration(modelRequest(modelId, { references: [referenceImage()] }))
    expect(vi.mocked(httpFetch).mock.calls[0]?.[0]).toContain(`/v1/images/${endpoint}`)
    expect(vi.mocked(httpFetch).mock.calls[1]?.[0]).toContain(`/v1/images/${endpoint}/task`)
    expect(vi.mocked(httpFetch).mock.calls[0]?.[1]?.json).toMatchObject({
        model_name: wireId,
        ...(modelId.endsWith('omni')
            ? { image_list: [{ image: btoa('reference') }] }
            : { image: btoa('reference') }),
    })
})

test('Ideogram 4.5 sends source files, size, count and quality as multipart', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(Response.json({ data: [{ url }] }))
    await runGeneration(
        modelRequest('ideogram-v4-5', {
            resolution: '2K',
            quality: 'high',
            references: [referenceImage()],
        }),
    )
    const [address, options] = vi.mocked(httpFetch).mock.calls[0] ?? []
    expect(address).toBe('https://api.ideogram.ai/v2/image/generate/ideogram-4-5')
    expect(options?.form?.get('size')).toBe('2048x2048')
    expect(options?.form?.get('quality')).toBe('high')
    expect(options?.form?.get('num_images')).toBe('1')
    expect(options?.form?.get('images')).toBeInstanceOf(File)
    expect(options?.form?.has('rendering_speed')).toBe(false)
})

test.each([
    ['seedream-5-flash', 'dola-seedream-5-0-flash-260915'],
    ['recraft-v4-1-pro', 'recraftv4_1_pro'],
])('%s sends its provider model ID and decodes the image', async (modelId, wireId) => {
    vi.mocked(httpFetch).mockResolvedValueOnce(Response.json({ data: [{ b64_json: b64 }] }))
    const images = await runGeneration(modelRequest(modelId))
    expect(await images[0]?.text()).toBe('image')
    expect(vi.mocked(httpFetch).mock.calls[0]?.[1]?.json).toMatchObject({ model: wireId })
})

test('Runway Image Turbo creates a task with its own model', async () => {
    vi.mocked(httpFetch)
        .mockResolvedValueOnce(Response.json({ id: 'task' }))
        .mockResolvedValueOnce(Response.json({ status: 'SUCCEEDED', output: [url] }))
    await runGeneration(modelRequest('gen-4-image-turbo'))
    expect(vi.mocked(httpFetch).mock.calls[0]?.[1]?.json).toMatchObject({
        model: 'gen4_image_turbo',
    })
    expect(httpFetch).toHaveBeenLastCalledWith(url, {})
})

test('Grok edits retain all five supported source images', async () => {
    vi.mocked(httpFetch).mockResolvedValueOnce(Response.json({ data: [{ b64_json: b64 }] }))
    await runGeneration(
        modelRequest('grok-imagine-image-2', {
            references: Array.from({ length: 5 }, referenceImage),
        }),
    )
    expect(vi.mocked(httpFetch).mock.calls[0]?.[1]?.json).toMatchObject({
        images: Array.from({ length: 5 }, () => ({ url: expect.any(String), type: 'image_url' })),
    })
})
