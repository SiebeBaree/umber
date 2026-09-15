/* eslint-disable no-await-in-loop -- Inspect each request before the shared mock records the next one. */
import { beforeEach, expect, test, vi } from 'vitest'

import { IMAGE_MODELS } from '../packages/ui/src/features/create/catalog'
import { estimateCost, formatCost } from '../packages/ui/src/features/create/pricing'
import {
    defaultModeSettings,
    reconcileToModel,
} from '../packages/ui/src/features/create/settings/reconcile'
import { generateOpenAiImages } from '../packages/ui/src/features/generate/openai'
import type { EngineRequest } from '../packages/ui/src/features/generate/request'
import { httpFetch } from '../packages/ui/src/lib/http'

vi.mock('../packages/ui/src/lib/http', () => ({ httpFetch: vi.fn() }))

beforeEach(() => {
    vi.mocked(httpFetch).mockReset()
    vi.mocked(httpFetch).mockImplementation(() =>
        Promise.resolve(Response.json({ data: [{ b64_json: 'aW1hZ2U=' }] })),
    )
})

const MODEL_IDS = ['gpt-image-2.5-flare', 'gpt-image-2.5-sunburst'] as const

function request(modelId: string, quality: string): EngineRequest {
    return {
        mode: 'image',
        providerId: 'openai',
        credentials: { apiKey: 'test-key' },
        modelId,
        quality,
        prompt: 'A lighthouse',
        count: 2,
        ratio: '16:9',
        resolution: '4K',
        durationSeconds: 0,
        references: [],
    }
}

test.each(MODEL_IDS)(
    '%s sends new quality tiers and custom dimensions for generation and edits',
    async (modelId) => {
        for (const quality of ['auto', 'low', 'medium', 'high', 'xhigh', 'max']) {
            const input = request(modelId, quality)
            const blobs = await generateOpenAiImages(input)
            expect(blobs[0]?.type).toBe('image/png')
            expect(httpFetch).toHaveBeenLastCalledWith(
                'https://api.openai.com/v1/images/generations',
                {
                    headers: { Authorization: 'Bearer test-key' },
                    json: {
                        model: modelId,
                        prompt: input.prompt,
                        n: 2,
                        size: '3840x2160',
                        quality,
                        output_format: 'png',
                    },
                },
            )

            const reference = new File(['reference'], 'reference.png', { type: 'image/png' })
            await generateOpenAiImages({ ...input, references: [reference] })
            const call = vi.mocked(httpFetch).mock.lastCall
            expect(call?.[0]).toBe('https://api.openai.com/v1/images/edits')
            const form = call?.[1]?.form
            expect(form?.get('model')).toBe(modelId)
            expect(form?.get('quality')).toBe(quality)
            expect(form?.get('size')).toBe('3840x2160')
            expect(form?.get('n')).toBe('2')
            expect(form?.get('image[]')).toMatchObject({
                name: reference.name,
                type: reference.type,
                size: reference.size,
            })
        }
    },
)

test.each(MODEL_IDS)(
    '%s retains supported settings without inventing a cost estimate',
    (modelId) => {
        const model = IMAGE_MODELS.find((entry) => entry.id === modelId)
        const older = IMAGE_MODELS.find((entry) => entry.id === 'gpt-image-2')
        if (model === undefined || older === undefined) throw new Error('Missing OpenAI model')
        for (const quality of model.quality?.options ?? []) {
            const settings = reconcileToModel({ ...defaultModeSettings('image'), quality }, model)
            expect(settings.quality).toBe(quality)
            if (quality === 'auto') {
                expect(estimateCost(model, settings)).toBeNull()
                expect(formatCost(estimateCost(model, settings))).toBe('Cost varies')
            } else {
                expect(estimateCost(model, settings)).toBeGreaterThan(0)
            }
            expect(older.quality?.options).toContain(reconcileToModel(settings, older).quality)
        }
    },
)

test.each(MODEL_IDS)(
    '%s sizes stay within OpenAI limits for every composer option',
    async (modelId) => {
        const model = IMAGE_MODELS.find((entry) => entry.id === modelId)
        if (model === undefined) throw new Error('Missing OpenAI model')
        for (const ratio of model.aspectRatios) {
            for (const resolution of model.resolutions) {
                await generateOpenAiImages({ ...request(modelId, 'medium'), ratio, resolution })
                const body = vi.mocked(httpFetch).mock.lastCall?.[1]?.json
                if (
                    typeof body !== 'object' ||
                    body === null ||
                    !('size' in body) ||
                    typeof body.size !== 'string'
                ) {
                    throw new Error('Missing image dimensions')
                }
                const dimensions = body.size.split('x').map(Number)
                const width = dimensions[0] ?? 0
                const height = dimensions[1] ?? 0
                expect(width % 16).toBe(0)
                expect(height % 16).toBe(0)
                expect(Math.max(width, height)).toBeLessThanOrEqual(3840)
                expect(Math.max(width, height) / Math.min(width, height)).toBeLessThanOrEqual(3)
                expect(width * height).toBeGreaterThanOrEqual(655360)
                expect(width * height).toBeLessThanOrEqual(8294400)
            }
        }
    },
)
