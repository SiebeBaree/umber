import { beforeEach, expect, test } from 'vitest'

import { IMAGE_MODELS } from '../packages/ui/src/features/create/catalog'
import { matchImageRatio } from '../packages/ui/src/features/create/first-image-ratio'
import {
    clearCreations,
    deleteCreations,
    listUsage,
    saveCreations,
    type CreationRecord,
} from '../packages/ui/src/features/gallery/creations-db'
import { editInput } from '../packages/ui/src/features/gallery/edit-input'
import { newJob } from '../packages/ui/src/features/generate/job'
import { summarizeUsage } from '../packages/ui/src/features/usage/usage-summary'

function model(id: string) {
    const found = IMAGE_MODELS.find((candidate) => candidate.id === id)
    if (found === undefined) throw new Error(`Missing model ${id}`)
    return found
}
const now = new Date(2026, 8, 21, 12).getTime()
const original: CreationRecord = {
    id: 'original',
    prompt: 'A landscape',
    modelId: 'gpt-image-2',
    modelName: 'GPT Image 2',
    providerId: 'openai',
    ratio: '16:9',
    resolution: '2K',
    quality: 'high',
    createdAt: now,
    image: new Blob(['image'], { type: 'image/png' }),
    estimatedCost: 0.2,
    generationMs: 8000,
}
beforeEach(async () => {
    await clearCreations()
})

test('first image preserves supported shapes and rejects incompatible fixed sizes', () => {
    expect(matchImageRatio(1920, 1080, model('nano-banana'))).toBe('16:9')
    expect(matchImageRatio(1200, 1000, model('gpt-image-2'))).toBe('1200:1000')
    expect(() => matchImageRatio(1920, 1080, model('gpt-image-1'))).toThrow('cannot preserve')
    expect(() => matchImageRatio(4000, 500, model('gpt-image-2'))).toThrow('cannot preserve')
    expect(() => matchImageRatio(0, 100, model('gpt-image-2'))).toThrow('dimensions')
})

test('edits keep the selected version settings and reference its stored image', async () => {
    await saveCreations([original])
    const input = await editInput(
        { ...original, kind: 'image', url: 'unused', mediaType: 'image/png' },
        'Make it snow',
    )
    expect(input.settings).toMatchObject({
        modelId: original.modelId,
        aspectRatio: '16:9',
        resolution: '2K',
        quality: 'high',
        outputCount: 1,
    })
    expect(input).toMatchObject({
        parentId: original.id,
        rootId: original.id,
        version: 2,
        prompt: 'Make it snow',
    })
    expect(input.references[0]?.type).toBe('image/png')
    const job = newJob(input)
    expect(job).toMatchObject({ parentId: original.id, rootId: original.id, version: 2 })
    expect(job.estimatedCost).toBeGreaterThan(0)
})

test('usage survives gallery deletion and is removed by erase all data', async () => {
    await saveCreations([original])
    await deleteCreations([original.id])
    const usage = await listUsage()
    expect(usage).toHaveLength(1)
    expect(usage[0]).not.toHaveProperty('image')
    await clearCreations()
    expect(await listUsage()).toEqual([])
})

test('usage includes local period boundaries, excludes future records and distinguishes missing costs', () => {
    const start = new Date(2026, 8, 15).getTime()
    const records = [
        original,
        {
            ...original,
            id: 'boundary',
            createdAt: start,
            estimatedCost: null,
            generationMs: undefined,
        },
        { ...original, id: 'too-old', createdAt: start - 1 },
        { ...original, id: 'future', createdAt: now + 1 },
    ]
    const summary = summarizeUsage(records, '7', now)
    expect(summary).toMatchObject({ count: 2, cost: 0.2, unknown: 1, averageMs: 8000 })
    expect(summary.buckets).toHaveLength(7)
    expect(summary.models[0]?.[1]).toMatchObject({ count: 2, unknown: 1 })
    expect(summarizeUsage([], '30', now).averageMs).toBeNull()
    expect(summarizeUsage(records, '365', now).count).toBe(3)
})

test('edits of older versions receive distinct numbers even after deleting newer images', async () => {
    await saveCreations([original])
    const edit = { ...original, rootId: original.id, parentId: original.id, version: 2 }
    const [second, third] = await Promise.all([
        saveCreations([{ ...edit, id: 'second' }]),
        saveCreations([{ ...edit, id: 'third' }]),
    ])
    expect(second[0]?.version).toBe(2)
    expect(third[0]?.version).toBe(3)
    await deleteCreations(['third'])
    const fourth = await saveCreations([{ ...edit, id: 'fourth' }])
    expect(fourth[0]?.version).toBe(4)
})
