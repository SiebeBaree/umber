// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, expect, test, vi } from 'vitest'

import { ApiJobs, type Dispatch } from '../apps/desktop/src/main/local-api/jobs'
import { SpendLedger } from '../apps/desktop/src/main/local-api/spend'
import type {
    LocalApiRequest,
    LocalApiResponse,
} from '../packages/ui/src/features/local-api/contract'

const directories: string[] = []

afterEach(async () => {
    await Promise.all(directories.splice(0).map((created) => rm(created, { recursive: true })))
})

/**
 * A dispatch stub whose image generation blocks until released, so a submitted
 * image job stays `running` while any number of video jobs settle around it.
 */
function blockingRenderer() {
    const gates: Array<(response: LocalApiResponse) => void> = []
    const dispatch = vi.fn<Dispatch>((request: LocalApiRequest) => {
        if (request.action === 'estimate')
            return Promise.resolve({ status: 200, body: { estimatedTotalCost: 0.01 } })
        if (request.action === 'models') return Promise.resolve({ status: 200, body: {} })
        if (request.kind === 'image') {
            return new Promise<LocalApiResponse>((resolve) => {
                gates.push(resolve)
            })
        }
        return Promise.resolve({ status: 200, body: { ok: true } })
    })
    return {
        dispatch,
        release: (response: LocalApiResponse) => gates.forEach((gate) => gate(response)),
    }
}

async function jobs() {
    const directory = await mkdtemp(join(tmpdir(), 'umber-jobs-test-'))
    directories.push(directory)
    const ledger = await SpendLedger.open(join(directory, 'spend.json'))
    const { dispatch, release } = blockingRenderer()
    const api = new ApiJobs({ dispatch, ledger, limits: () => [], settled: vi.fn() })
    return { api, dispatch, release }
}

/** The 202 body always carries the job description; a failed estimate would not. */
function pollBody(response: LocalApiResponse): { id: string; status: string } {
    if (!('body' in response) || typeof response.body !== 'object' || response.body === null)
        throw new Error('Expected a 202 body with a job description')
    return response.body as { id: string; status: string }
}

test('a burst of settling video jobs never evicts a running image job', async () => {
    const { api } = await jobs()
    const image = await api.submit('image', { prompt: 'blocked' }, 'image-key')
    expect(image.status).toBe(202)
    const imageJobId = pollBody(image).id

    // Each video must settle before the next admission: admissions run one at
    // a time and a still-active video kind would answer 429.
    for (let index = 0; index < 32; index += 1) {
        // oxlint-disable-next-line eslint/no-await-in-loop
        const video = await api.submit('video', { prompt: `video ${index}` }, `video-key-${index}`)
        expect(video.status).toBe(202)
    }

    expect(api.get(imageJobId)).toMatchObject({ id: imageJobId, status: 'running' })
})

test('a replay of an evicted-burst key returns the same job without dispatching again', async () => {
    const { api, dispatch } = await jobs()
    const image = await api.submit('image', { prompt: 'blocked' }, 'image-key')
    const imageJobId = pollBody(image).id
    // Each video must settle before the next admission: admissions run one at
    // a time and a still-active video kind would answer 429.
    for (let index = 0; index < 32; index += 1) {
        // oxlint-disable-next-line eslint/no-await-in-loop
        await api.submit('video', { prompt: `video ${index}` }, `video-key-${index}`)
    }

    const replay = await api.submit('image', { prompt: 'blocked' }, 'image-key')

    expect(replay.status).toBe(202)
    expect(pollBody(replay)).toMatchObject({ id: imageJobId, status: 'running' })
    const imageGenerations = dispatch.mock.calls.filter(
        ([request]) => request.action === 'generate' && request.kind === 'image',
    )
    expect(imageGenerations).toHaveLength(1)
})
