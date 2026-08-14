import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, test, vi } from 'vitest'

// Reached by path rather than through `@umber/ui`: the generation store is an
// internal of the create flow, not part of the package's public surface.
import { defaultModel } from '../packages/ui/src/features/create/catalog'
import type { ModeSettings } from '../packages/ui/src/features/create/settings/schema'
import {
    GenerationProvider,
    useGeneration,
    type GenerationApi,
} from '../packages/ui/src/features/generate/generation-context'
import { KeysProvider } from '../packages/ui/src/features/keys/keys-context'
import type { KeyVault } from '../packages/ui/src/features/keys/vault'

/**
 * Several runs at once: starting one never waits on the one before it, results
 * may land in any order, and each run settles into its own place on the stage.
 */

/** Every provider call left hanging, by the prompt that started it. */
const pending = new Map<string, (blobs: Blob[]) => void>()

vi.mock('../packages/ui/src/features/generate/engine', () => ({
    runGeneration: (request: { readonly prompt: string }) =>
        new Promise<Blob[]>((resolve) => {
            pending.set(request.prompt, resolve)
        }),
}))

const vault: KeyVault = {
    list: () => Promise.resolve([{ providerId: 'openai', keyTail: '1234', addedAt: '' }]),
    save: () => Promise.reject(new Error('the test never connects a key')),
    remove: () => Promise.resolve(),
    credentials: () => Promise.resolve({ apiKey: 'test-key' }),
}

const MODEL = defaultModel('image')

const SETTINGS: ModeSettings = {
    modelId: MODEL.id,
    aspectRatio: MODEL.aspectRatios[0],
    resolution: MODEL.resolutions[0],
    quality: 'medium',
    outputCount: 1,
    durationSeconds: 4,
}

/** Hands the store itself to the test; nothing here renders anything. */
const store: { api: GenerationApi | null } = { api: null }

function Probe() {
    store.api = useGeneration()

    return null
}

function api(): GenerationApi {
    if (store.api === null) {
        throw new Error('the probe never mounted')
    }

    return store.api
}

function mount() {
    const container = document.createElement('div')
    document.body.append(container)

    act(() => {
        createRoot(container).render(
            <StrictMode>
                <KeysProvider vault={vault}>
                    <GenerationProvider>
                        <Probe />
                    </GenerationProvider>
                </KeysProvider>
            </StrictMode>,
        )
    })
}

function start(prompt: string) {
    act(() => {
        api().start({ prompt, model: MODEL, settings: SETTINGS, references: [] })
    })
}

/**
 * Lands one provider call, then lets the run's own promises finish. The call
 * itself is reached one credential lookup after `start`, so it is waited for
 * rather than assumed.
 */
async function finish(prompt: string) {
    await vi.waitFor(() => {
        expect(pending.get(prompt)).toBeDefined()
    })

    await act(async () => {
        pending.get(prompt)?.([new Blob(['pretend png'], { type: 'image/png' })])

        // A turn of the loop, so the run's own promises — the gallery write
        // among them — are all done before `act` flushes what they queued.
        await new Promise((resolve) => {
            setTimeout(resolve, 0)
        })
    })

    expect(api().jobs.some((job) => job.prompt === prompt && job.status === 'done')).toBe(true)
}

/** React only allows `act` where the environment says tests are running. */
declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean
}

beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    pending.clear()
    store.api = null

    // jsdom has no object URLs, and the store mints one per output.
    URL.createObjectURL = vi.fn(() => `blob:umber/${pending.size}`)
    URL.revokeObjectURL = vi.fn()
})

test('a second run starts while the first is still rendering', () => {
    mount()

    start('a lighthouse')
    start('a harbour')

    expect(api().jobs.map((job) => job.prompt)).toEqual(['a lighthouse', 'a harbour'])
    expect(api().running).toBe(2)
})

test('runs settle into their own place, whatever order they land in', async () => {
    mount()

    start('a lighthouse')
    start('a harbour')

    await finish('a harbour')

    expect(api().jobs.map((job) => job.status)).toEqual(['running', 'done'])
    expect(api().running).toBe(1)

    await finish('a lighthouse')

    expect(api().jobs.map((job) => job.status)).toEqual(['done', 'done'])
    expect(api().running).toBe(0)
})

test('dismissing one run leaves the others alone', async () => {
    mount()

    start('a lighthouse')
    start('a harbour')
    await finish('a lighthouse')

    const dismissed = api().jobs[0]
    const url = dismissed?.status === 'done' ? dismissed.outputs[0]?.url : null

    act(() => {
        api().dismiss(dismissed?.id ?? '')
    })

    expect(api().jobs.map((job) => job.prompt)).toEqual(['a harbour'])
    expect(api().running).toBe(1)

    // The dismissed run's file goes with it, and only its own.
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
})

test('clearing the stage keeps the runs that are still going', async () => {
    mount()

    start('a lighthouse')
    start('a harbour')
    start('a jetty')
    await finish('a lighthouse')
    await finish('a jetty')

    act(() => {
        api().clearFinished()
    })

    expect(api().jobs.map((job) => job.prompt)).toEqual(['a harbour'])
    expect(api().running).toBe(1)

    // Both cleared runs release their files; the working one holds nothing yet.
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
})
