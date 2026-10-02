// @vitest-environment node
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, expect, test, vi } from 'vitest'

import { ApiController } from '../apps/desktop/src/main/local-api/controller'
import { readPreferences } from '../apps/desktop/src/main/local-api/preferences'

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
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })))
})

async function controller() {
    const directory = await mkdtemp(join(tmpdir(), 'umber-api-test-'))
    directories.push(directory)
    const path = join(directory, 'api.json')
    const changed = vi.fn()
    const api = new ApiController(path, await readPreferences(path), 'docs', vi.fn(), changed)
    return { path, api, changed }
}

test('disabled startup opens no listener; toggles persist and reset disables the API', async () => {
    const { path, api } = await controller()
    await api.ready()
    expect(listener.start).not.toHaveBeenCalled()
    await api.setEnabled(true)
    expect(await readPreferences(path)).toEqual({ enabled: true })
    expect((await stat(path)).mode & 0o777).toBe(0o600)
    expect(api.status().listening).toBe(true)
    await api.setEnabled(false)
    expect(await readPreferences(path)).toEqual({ enabled: false })
    await api.reset()
    expect(api.status()).toMatchObject({ enabled: false, listening: false })
    expect(listener.clearJobs).toHaveBeenCalledOnce()
})

test('reset stops admission before checking active generation and preserves access when reset is blocked', async () => {
    const { path, api } = await controller()
    await api.setEnabled(true)
    const previous = await readPreferences(path)
    // A request was accepted just before the listener finished closing.
    listener.stop.mockImplementationOnce(() => {
        listener.busy = true
        return Promise.resolve()
    })
    await expect(api.reset()).rejects.toThrow('Wait for the API generation')
    expect(await readPreferences(path)).toEqual(previous)
    expect(listener.clearJobs).not.toHaveBeenCalled()
    expect(api.status().listening).toBe(true)
})

test('port conflicts are visible and a later toggle can recover', async () => {
    const { api, changed } = await controller()
    listener.start.mockRejectedValueOnce(new Error('EADDRINUSE'))
    await api.setEnabled(true)
    expect(changed).toHaveBeenLastCalledWith(
        expect.objectContaining({
            enabled: true,
            listening: false,
            error: expect.stringContaining('port 19432'),
        }),
    )
    await api.setEnabled(false)
    await api.setEnabled(true)
    expect(api.status()).toMatchObject({ enabled: true, listening: true, error: null })
})
