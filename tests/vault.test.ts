// @vitest-environment node
import type { IpcMainInvokeEvent } from 'electron'
import { beforeEach, expect, test, vi } from 'vitest'

import { trustRendererUrl } from '../apps/desktop/src/main/ipc-guard'
import { registerVaultIpc } from '../apps/desktop/src/main/vault'
import { VAULT_CHANNELS } from '../apps/desktop/src/shared/bridge'

const { fs, app, safeStorage, ipcMain } = await vi.hoisted(() => {
    const fsMock = {
        mkdir: vi.fn<() => Promise<void>>(),
        readFile: vi.fn<() => Promise<string>>(),
        writeFile: vi.fn<(path: string, data: string, options?: object) => Promise<void>>(),
        rename: vi.fn<() => Promise<void>>(),
        chmod: vi.fn<() => Promise<void>>(),
    }
    const ipcMainMock = {
        handle: vi.fn<(channel: string, handler: (...args: unknown[]) => unknown) => void>(),
    }

    return {
        fs: fsMock,
        app: { getPath: vi.fn<() => string>(() => '/fake/userData') },
        // Encryption available, so records take the safeStorage path.
        safeStorage: {
            isEncryptionAvailable: vi.fn(() => true),
            encryptString: vi.fn((value: string) => Buffer.from(value, 'utf8')),
        },
        ipcMain: ipcMainMock,
    }
})

vi.mock('node:fs/promises', () => fs)
vi.mock('../apps/desktop/node_modules/electron', () => ({ app, ipcMain, safeStorage }))

const rendererUrl = 'file:///umber/renderer/index.html'
const caller = { senderFrame: { url: rendererUrl } } as IpcMainInvokeEvent

/** Invokes the vault handler registered for `channel`, as the app's own document. */
function invoke(channel: string, ...args: unknown[]): unknown {
    const handler = vi.mocked(ipcMain.handle).mock.calls.find(([name]) => name === channel)?.[1]
    if (!handler) throw new Error(`Missing handler: ${channel}`)

    return handler(caller, ...args)
}

beforeEach(() => {
    vi.clearAllMocks()
    fs.readFile.mockRejectedValue(Object.assign(new Error('no vault yet'), { code: 'ENOENT' }))
    trustRendererUrl(rendererUrl)
    registerVaultIpc()
})

test('the saved entry and its credentials land on disk owner-only', async () => {
    const connection = (await invoke(VAULT_CHANNELS.save, {
        providerId: 'openai',
        credentials: { apiKey: 'sk-test' },
        keyTail: 'sk-test',
    })) as { providerId: string; keyTail: string }

    expect(connection.providerId).toBe('openai')

    expect(fs.writeFile).toHaveBeenCalledTimes(1)
    const [temporary, , options] = vi.mocked(fs.writeFile).mock.calls[0] ?? []
    expect(temporary).toBe('/fake/userData/vault.json.tmp')
    expect(options).toMatchObject({ mode: 0o600 })

    // Older vaults keep their old mode until the next save tightens them.
    expect(fs.chmod).toHaveBeenCalledWith('/fake/userData/vault.json', 0o600)
    // And the tightening happens after the temp file is in place.
    const [renameOrder] = vi.mocked(fs.rename).mock.invocationCallOrder
    const [chmodOrder] = vi.mocked(fs.chmod).mock.invocationCallOrder
    expect(chmodOrder).toBeGreaterThan(renameOrder ?? 0)
})

test('saving null credentials is rejected and writes nothing', async () => {
    await expect(
        invoke(VAULT_CHANNELS.save, { providerId: 'openai', credentials: null }),
    ).rejects.toThrow('Malformed vault entry')

    expect(fs.writeFile).not.toHaveBeenCalled()
})
