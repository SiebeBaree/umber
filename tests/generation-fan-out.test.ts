import { expect, test } from 'vitest'

import { GenerationError } from '../packages/ui/src/features/generate/errors'
import type { EngineRequest } from '../packages/ui/src/features/generate/request'
import { fanOut } from '../packages/ui/src/features/generate/shared'

/**
 * A run of several images is several independent provider calls, and one of
 * them failing is not the run failing: whatever landed is still what the user
 * asked for, and the gap is reported rather than thrown.
 */

function requestFor(count: number, onAttemptFailed?: (message: string) => void): EngineRequest {
    return {
        mode: 'image',
        providerId: 'reve',
        credentials: { apiKey: 'test-key' },
        modelId: 'reve-image',
        prompt: 'a lighthouse',
        count,
        ratio: '1:1',
        resolution: '1K',
        quality: '',
        durationSeconds: 0,
        references: [],
        ...(onAttemptFailed === undefined ? {} : { onAttemptFailed }),
    }
}

const png = () => new Blob(['pretend png'], { type: 'image/png' })

test('every attempt landing is reported as nothing gone wrong', async () => {
    const reported: string[] = []

    const blobs = await fanOut(
        requestFor(3, (message) => reported.push(message)),
        () => Promise.resolve(png()),
    )

    expect(blobs).toHaveLength(3)
    expect(reported).toEqual([])
})

test('one attempt failing keeps the others and reports the one', async () => {
    const reported: string[] = []
    let attempt = 0

    const blobs = await fanOut(
        requestFor(3, (message) => reported.push(message)),
        () => {
            attempt += 1

            return attempt === 2
                ? Promise.reject(new GenerationError('Reve is out of credits.'))
                : Promise.resolve(png())
        },
    )

    expect(blobs).toHaveLength(2)
    expect(reported).toEqual(['Reve is out of credits.'])
})

test('every attempt failing is an ordinary failure, told in the first reason', async () => {
    const reported: string[] = []

    await expect(
        fanOut(
            requestFor(2, (message) => reported.push(message)),
            () => Promise.reject(new GenerationError('Reve is out of credits.')),
        ),
    ).rejects.toThrow('Reve is out of credits.')

    // Nothing partial happened, so nothing was reported as partial.
    expect(reported).toEqual([])
})
