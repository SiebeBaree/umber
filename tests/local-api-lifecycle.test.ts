// @vitest-environment node
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, expect, test, vi } from 'vitest'

import { ApiController } from '../apps/desktop/src/main/local-api/controller'
import { readSettings, writeJson } from '../apps/desktop/src/main/local-api/preferences'
import { SpendLedger } from '../apps/desktop/src/main/local-api/spend'

const listener = vi.hoisted(() => ({
    busy: false,
    start: vi.fn(() => Promise.resolve(19432)),
    stop: vi.fn(() => Promise.resolve()),
    clearJobs: vi.fn(),
}))
vi.mock('../apps/desktop/src/main/local-api/server', () => ({
    LocalApiServer: class {
        start = listener.start
        stop = listener.stop
        clearJobs = listener.clearJobs
        get busy() {
            return listener.busy
        }
    },
}))
const directories: string[] = []

afterEach(async () => {
    listener.busy = false
    vi.clearAllMocks()
    await Promise.all(directories.splice(0).map((created) => rm(created, { recursive: true })))
})

async function directory() {
    const created = await mkdtemp(join(tmpdir(), 'umber-api-test-'))
    directories.push(created)
    return created
}

async function controller() {
    const root = await directory()
    const path = join(root, 'api.json')
    const changed = vi.fn()
    const ledger = await SpendLedger.open(join(root, 'spend.json'))
    const api = new ApiController(path, await readSettings(path), ledger, 'docs', vi.fn(), changed)
    return { path, api, changed, ledger }
}

test('disabled startup opens no listener; toggles persist and reset disables the API', async () => {
    const { path, api } = await controller()
    await api.ready()
    expect(listener.start).not.toHaveBeenCalled()
    await api.update({ enabled: true })
    expect(await readSettings(path)).toEqual({ enabled: true, access: 'images', limits: [] })
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect(api.status().listening).toBe(true)
    await api.update({ enabled: false })
    expect(await readSettings(path)).toMatchObject({ enabled: false })
    await api.reset()
    expect(api.status()).toMatchObject({ enabled: false, listening: false })
    expect(listener.clearJobs).toHaveBeenCalledOnce()
})

test('reset stops admission before checking active generation and preserves access when reset is blocked', async () => {
    const { path, api } = await controller()
    await api.update({ enabled: true })
    const previous = await readSettings(path)
    // A request was accepted just before the listener finished closing.
    listener.stop.mockImplementationOnce(() => {
        listener.busy = true
        return Promise.resolve()
    })
    await expect(api.reset()).rejects.toThrow('Wait for the API generation')
    expect(await readSettings(path)).toEqual(previous)
    expect(listener.clearJobs).not.toHaveBeenCalled()
    expect(api.status().listening).toBe(true)
})

test('port conflicts are visible and a later toggle can recover', async () => {
    const { api, changed } = await controller()
    listener.start.mockRejectedValueOnce(new Error('EADDRINUSE'))
    await api.update({ enabled: true })
    expect(changed).toHaveBeenLastCalledWith(
        expect.objectContaining({
            enabled: true,
            listening: false,
            error: expect.stringContaining('port 19432'),
        }),
    )
    await api.update({ enabled: false })
    await api.update({ enabled: true })
    expect(api.status()).toMatchObject({ enabled: true, listening: true, error: null })
})

test('settings from before access and limits read with images only and no limits', async () => {
    const path = join(await directory(), 'api.json')
    await writeJson(path, { enabled: true })
    expect(await readSettings(path)).toEqual({ enabled: true, access: 'images', limits: [] })
})

test('updates validate every field, keep one limit per period and reset clears spend', async () => {
    const { path, api, ledger } = await controller()
    await expect(api.update({ access: 'everything' })).rejects.toThrow('Access')
    await expect(api.update({ limits: [{ usd: -1, days: 7 }] })).rejects.toThrow('positive')
    await expect(api.update({ limits: [{ usd: 1, days: 3 }] })).rejects.toThrow('period')
    expect(await readSettings(path)).toEqual({ enabled: false, access: 'images', limits: [] })
    await api.update({
        access: 'both',
        limits: [
            { usd: 10, days: null },
            { usd: 3, days: 7 },
            { usd: 2, days: 7 },
        ],
    })
    expect((await readSettings(path)).limits).toEqual([
        { usd: 2, days: 7 },
        { usd: 10, days: null },
    ])
    await ledger.record(1.5)
    expect(api.status().limits).toEqual([
        { usd: 2, days: 7, spent: 1.5 },
        { usd: 10, days: null, spent: 1.5 },
    ])
    await api.reset()
    expect(api.status()).toMatchObject({ access: 'images', limits: [] })
    expect(ledger.spent(null)).toBe(0)
})

test('the ledger rolls windows, survives a restart and refuses what a limit cannot cover', async () => {
    const path = join(await directory(), 'spend.json')
    const ledger = await SpendLedger.open(path)
    const day = 86_400_000
    const now = Date.now()
    await ledger.record(4, now - 10 * day)
    await ledger.record(1, now - day / 2)
    expect(ledger.spent(1)).toBe(1)
    expect(ledger.spent(7)).toBe(1)
    expect(ledger.spent(30)).toBe(5)
    expect(ledger.spent(null)).toBe(5)
    expect((await SpendLedger.open(path)).spent(null)).toBe(5)

    const limits = [{ usd: 2, days: 7 as const }]
    const release = ledger.reserve(limits, 0.6)
    // The first request's hold counts against the second until it settles.
    expect(() => ledger.reserve(limits, 0.6)).toThrow('$0.40 left')
    release()
    expect(() => ledger.reserve(limits, 0.6)).not.toThrow()
    expect(() => ledger.reserve(limits, null)).toThrow('no cost estimate')
    expect(() => ledger.reserve([], null)).not.toThrow()
})
