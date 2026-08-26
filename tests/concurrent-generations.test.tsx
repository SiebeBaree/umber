import { act, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, test, vi } from 'vitest'

// Reached by path rather than through `@umber/ui`: the generation store is an
// internal of the create flow, not part of the package's public surface.
import { defaultModel } from '../packages/ui/src/features/create/catalog'
import type { ModeSettings } from '../packages/ui/src/features/create/settings/schema'
import { GenerationError } from '../packages/ui/src/features/generate/errors'
import {
    GenerationProvider,
    useGeneration,
    type GenerationApi,
} from '../packages/ui/src/features/generate/generation-context'
import { KeysProvider } from '../packages/ui/src/features/keys/keys-context'
import type { KeyVault } from '../packages/ui/src/features/keys/vault'
import {
    NotificationsProvider,
    useNotifications,
    type NotificationsApi,
} from '../packages/ui/src/features/notifications/notifications-context'

/**
 * Several runs at once: starting one never waits on the one before it, results
 * may land in any order, and each run settles into its own place on the stage.
 */

/** Every provider call left hanging, by the prompt that started it. */
interface PendingCall {
    readonly resolve: (blobs: Blob[]) => void
    readonly reject: (error: unknown) => void
}

const pending = new Map<string, PendingCall>()

vi.mock('../packages/ui/src/features/generate/engine', () => ({
    runGeneration: (request: { readonly prompt: string }) =>
        new Promise<Blob[]>((resolve, reject) => {
            pending.set(request.prompt, { resolve, reject })
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

/** Hands the two stores themselves to the test; nothing here renders anything. */
const store: { api: GenerationApi | null; notices: NotificationsApi | null } = {
    api: null,
    notices: null,
}

function Probe() {
    store.api = useGeneration()
    store.notices = useNotifications()

    return null
}

function api(): GenerationApi {
    if (store.api === null) {
        throw new Error('the probe never mounted')
    }

    return store.api
}

function notices(): NotificationsApi {
    if (store.notices === null) {
        throw new Error('the probe never mounted')
    }

    return store.notices
}

function mount() {
    const container = document.createElement('div')
    document.body.append(container)

    act(() => {
        createRoot(container).render(
            <StrictMode>
                <KeysProvider vault={vault}>
                    <NotificationsProvider>
                        <GenerationProvider>
                            <Probe />
                        </GenerationProvider>
                    </NotificationsProvider>
                </KeysProvider>
            </StrictMode>,
        )
    })
}

function start(prompt: string, outputCount = 1) {
    act(() => {
        api().start({
            prompt,
            model: MODEL,
            settings: { ...SETTINGS, outputCount },
            references: [],
        })
    })
}

/** One image, as the mocked provider hands them back. */
function png() {
    return new Blob(['pretend png'], { type: 'image/png' })
}

/** Waits for the run's provider call, then lets its own promises finish. */
async function land(prompt: string, settle: (call: PendingCall) => void) {
    await vi.waitFor(() => {
        expect(pending.get(prompt)).toBeDefined()
    })

    await act(async () => {
        const call = pending.get(prompt)

        if (call !== undefined) {
            settle(call)
        }

        await new Promise((resolve) => {
            setTimeout(resolve, 0)
        })
    })
}

/**
 * Lands one provider call, then lets the run's own promises finish. The call
 * itself is reached one credential lookup after `start`, so it is waited for
 * rather than assumed.
 */
async function finish(prompt: string, images = 1) {
    // A turn of the loop inside `land`, so the run's own promises — the gallery
    // write among them — are all done before `act` flushes what they queued.
    await land(prompt, (call) => {
        call.resolve(Array.from({ length: images }, () => png()))
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
    store.notices = null

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

test('clearing one finished run releases its files and only its own', async () => {
    mount()

    start('a lighthouse')
    start('a harbour')
    await finish('a lighthouse')

    const cleared = api().jobs[0]
    const url = cleared?.status === 'done' ? cleared.outputs[0]?.url : null

    act(() => {
        api().clearFinished()
    })

    expect(api().jobs.map((job) => job.prompt)).toEqual(['a harbour'])
    expect(api().running).toBe(1)

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

test('a run that makes nothing leaves the stage and says why', async () => {
    mount()

    start('a lighthouse')
    start('a harbour')

    await land('a harbour', (call) => {
        call.reject(new GenerationError('Reve is having trouble on their end.'))
    })

    // Gone from the stage entirely: there is no failed tile to dismiss.
    expect(api().jobs.map((job) => job.prompt)).toEqual(['a lighthouse'])
    expect(notices().notifications.map((notice) => notice.body)).toEqual([
        'Reve is having trouble on their end.',
    ])
})

test('a failure nobody wrote a sentence for still reads as English', async () => {
    mount()

    start('a lighthouse')

    await land('a lighthouse', (call) => {
        call.reject(new TypeError('undefined is not a function'))
    })

    expect(notices().notifications[0]?.body).toBe(
        'Something went wrong while generating. Try again.',
    )
})

test('a run that makes some of what was asked keeps them and accounts for the rest', async () => {
    mount()

    start('a lighthouse', 2)
    await finish('a lighthouse', 1)

    const job = api().jobs[0]

    // The run stays, holding the one picture that landed — the stage draws a
    // single tile from `outputs`, not a pair with a hole in it.
    expect(job?.status === 'done' ? job.outputs.length : 0).toBe(1)
    expect(job?.count).toBe(2)

    expect(notices().notifications[0]?.title).toBe('1 of 2 images came out')
})
