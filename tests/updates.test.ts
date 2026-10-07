// @vitest-environment node
// Electron and electron-updater both use Node event emitters.
/* oxlint-disable unicorn/prefer-event-target */
import type { IpcMainInvokeEvent } from 'electron'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { trustRendererUrl } from '../apps/desktop/src/main/ipc-guard'
import { registerUpdatesIpc } from '../apps/desktop/src/main/updates'
import { readAppVersionArgument, UPDATE_CHANNELS } from '../apps/desktop/src/shared/bridge'

const { mocks, app, nativeUpdater, autoUpdater, ipcMain, dialog } = await vi.hoisted(async () => {
    const { EventEmitter } = await import('node:events')
    const controls = {
        packaged: true,
        send: vi.fn(),
        check: vi.fn<() => Promise<{ downloadPromise?: Promise<string[]> } | null>>(),
        install: vi.fn(),
    }
    return {
        mocks: controls,
        app: Object.defineProperty(new EventEmitter(), 'isPackaged', {
            get: () => controls.packaged,
        }),
        nativeUpdater: new EventEmitter(),
        autoUpdater: Object.assign(new EventEmitter(), {
            checkForUpdates: controls.check,
            quitAndInstall: controls.install,
        }),
        ipcMain: {
            handle: vi.fn<
                (channel: string, handler: (event: IpcMainInvokeEvent) => unknown) => void
            >(),
        },
        dialog: {
            showMessageBox: vi.fn<() => Promise<{ response: number; checkboxChecked: boolean }>>(),
        },
    }
})
// Resolve the desktop's dependencies, rather than synthetic modules at the workspace root.
vi.mock('../apps/desktop/node_modules/electron', () => ({
    app,
    autoUpdater: nativeUpdater,
    BrowserWindow: {
        getAllWindows: () => [{ webContents: { send: mocks.send, isDestroyed: () => false } }],
    },
    ipcMain,
    dialog,
}))
vi.mock('../apps/desktop/node_modules/electron-updater', () => ({ autoUpdater }))

const platform = process.platform
const rendererUrl = 'file:///umber/renderer/index.html'
const caller = { senderFrame: { url: rendererUrl } } as IpcMainInvokeEvent

function invoke(channel: string, event = caller): unknown {
    const handler = vi.mocked(ipcMain.handle).mock.calls.find(([name]) => name === channel)?.[1]
    if (!handler) throw new Error(`Missing handler: ${channel}`)
    return handler(event)
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    mocks.packaged = true
    mocks.check.mockImplementation(() => {
        autoUpdater.emit('update-not-available', { version: '0.2.0' })
        return Promise.resolve(null)
    })
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    trustRendererUrl(rendererUrl)
})

afterEach(() => {
    app.removeAllListeners()
    autoUpdater.removeAllListeners()
    nativeUpdater.removeAllListeners()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    Object.defineProperty(process, 'platform', { value: platform })
})

test('development builds and unpacked Linux copies never check, download or install', async () => {
    mocks.packaged = false
    registerUpdatesIpc()
    await invoke(UPDATE_CHANNELS.check)
    await invoke(UPDATE_CHANNELS.install)
    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000)
    expect(mocks.check).not.toHaveBeenCalled()
    expect(mocks.install).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)

    vi.mocked(ipcMain.handle).mockClear()
    mocks.packaged = true
    Object.defineProperty(process, 'platform', { value: 'linux' })
    vi.stubEnv('APPIMAGE', '')
    registerUpdatesIpc()
    await invoke(UPDATE_CHANNELS.check)
    expect(mocks.check).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
})

test('checks at startup and every six hours, with stable automatic downloads enabled', async () => {
    registerUpdatesIpc()
    expect(autoUpdater).toMatchObject({
        autoDownload: true,
        autoInstallOnAppQuit: true,
        autoRunAppAfterInstall: true,
        allowPrerelease: false,
        allowDowngrade: false,
    })
    await vi.advanceTimersByTimeAsync(9_999)
    expect(mocks.check).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(mocks.check).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)
    expect(mocks.check).toHaveBeenCalledTimes(2)
    expect(invoke(UPDATE_CHANNELS.status)).toEqual({ state: 'idle', latestVersion: null })
    app.emit('before-quit')
    expect(vi.getTimerCount()).toBe(0)
})

test('checks cannot overlap an automatic download or erase a ready update', async () => {
    let finish: (() => void) | undefined
    const download = new Promise<string[]>((resolve) => {
        finish = () => resolve([])
    })
    mocks.check.mockImplementationOnce(() => {
        autoUpdater.emit('update-available', { version: '0.3.0' })
        return Promise.resolve({ downloadPromise: download })
    })
    registerUpdatesIpc()
    const pending = invoke(UPDATE_CHANNELS.check)
    await invoke(UPDATE_CHANNELS.check)
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)
    expect(mocks.check).toHaveBeenCalledOnce()
    autoUpdater.emit('download-progress', { percent: 42.9 })
    expect(mocks.send).toHaveBeenLastCalledWith(UPDATE_CHANNELS.changed, {
        state: 'downloading',
        latestVersion: '0.3.0',
        percent: 42,
    })
    autoUpdater.emit('update-downloaded', { version: '0.3.0' })
    finish?.()
    await pending
    await invoke(UPDATE_CHANNELS.check)
    expect(dialog.showMessageBox).not.toHaveBeenCalled()
    expect(invoke(UPDATE_CHANNELS.status)).toMatchObject({ state: 'downloading', percent: 100 })

    nativeUpdater.emit('update-downloaded')
    await Promise.resolve()
    expect(invoke(UPDATE_CHANNELS.status)).toEqual({ state: 'ready', latestVersion: '0.3.0' })
    expect(dialog.showMessageBox).toHaveBeenCalledWith(
        expect.objectContaining({
            buttons: ['Restart now', 'Later'],
            defaultId: 1,
            cancelId: 1,
        }),
    )
    expect(mocks.install).not.toHaveBeenCalled()
    await invoke(UPDATE_CHANNELS.check)
    expect(mocks.check).toHaveBeenCalledOnce()
    await invoke(UPDATE_CHANNELS.install)
    await invoke(UPDATE_CHANNELS.install)
    expect(mocks.install).toHaveBeenCalledExactlyOnceWith(false, true)
})

test.each(['win32', 'linux'])(
    '%s prompts after download and restarts only on consent',
    async (os) => {
        Object.defineProperty(process, 'platform', { value: os })
        vi.stubEnv('APPIMAGE', '/tmp/Umber.AppImage')
        vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 0, checkboxChecked: false })
        registerUpdatesIpc()
        autoUpdater.emit('update-available', { version: '0.3.0' })
        expect(mocks.install).not.toHaveBeenCalled()
        autoUpdater.emit('update-downloaded', { version: '0.3.0' })
        await Promise.resolve()
        expect(dialog.showMessageBox).toHaveBeenCalledOnce()
        expect(mocks.install).toHaveBeenCalledExactlyOnceWith(false, true)
        expect(invoke(UPDATE_CHANNELS.status)).toMatchObject({ state: 'installing' })
    },
)

test('download rejection is observed and a retry can recover', async () => {
    let rejectDownload: ((error: Error) => void) | undefined
    const download = new Promise<string[]>((_resolve, reject) => {
        rejectDownload = reject
    })
    mocks.check.mockImplementationOnce(() => {
        autoUpdater.emit('update-available', { version: '0.3.0' })
        return Promise.resolve({ downloadPromise: download })
    })
    registerUpdatesIpc()
    const pending = invoke(UPDATE_CHANNELS.check)
    const error = new Error('Connection interrupted')
    autoUpdater.emit('error', error)
    rejectDownload?.(error)
    await pending
    expect(invoke(UPDATE_CHANNELS.status)).toMatchObject({ state: 'error', latestVersion: '0.3.0' })
    await invoke(UPDATE_CHANNELS.install)
    expect(mocks.install).not.toHaveBeenCalled()
    await invoke(UPDATE_CHANNELS.check)
    expect(mocks.check).toHaveBeenCalledTimes(2)
    expect(invoke(UPDATE_CHANNELS.status)).toMatchObject({ state: 'idle' })
})

test('macOS verification errors never offer restart and retry waits for native readiness', async () => {
    registerUpdatesIpc()
    autoUpdater.emit('update-downloaded', { version: '0.3.0' })
    autoUpdater.emit('error', new Error('Invalid code signature'))
    nativeUpdater.emit('update-downloaded')
    expect(dialog.showMessageBox).not.toHaveBeenCalled()
    await invoke(UPDATE_CHANNELS.install)
    expect(mocks.install).not.toHaveBeenCalled()
    await invoke(UPDATE_CHANNELS.check)
    autoUpdater.emit('update-downloaded', { version: '0.3.0' })
    nativeUpdater.emit('update-downloaded')
    expect(dialog.showMessageBox).toHaveBeenCalledOnce()
})

test('a failed installation returns to a recoverable state', async () => {
    registerUpdatesIpc()
    autoUpdater.emit('update-downloaded', { version: '0.3.0' })
    nativeUpdater.emit('update-downloaded')
    await Promise.resolve()
    mocks.install.mockImplementationOnce(() => {
        autoUpdater.emit('error', new Error('Permission denied'))
    })
    await invoke(UPDATE_CHANNELS.install)
    expect(invoke(UPDATE_CHANNELS.status)).toMatchObject({
        state: 'error',
        message: 'The update could not be installed. Try again.',
    })
    await invoke(UPDATE_CHANNELS.check)
    expect(mocks.check).toHaveBeenCalledOnce()
})

test('offline checks recover on the next scheduled check', async () => {
    mocks.check.mockRejectedValueOnce(new Error('Offline'))
    registerUpdatesIpc()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(invoke(UPDATE_CHANNELS.status)).toMatchObject({ state: 'error' })
    await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000)
    expect(invoke(UPDATE_CHANNELS.status)).toMatchObject({ state: 'idle' })
})

test('only the trusted renderer can control or inspect updates', () => {
    registerUpdatesIpc()
    const foreign = { senderFrame: { url: 'https://example.com' } } as IpcMainInvokeEvent
    for (const channel of [
        UPDATE_CHANNELS.status,
        UPDATE_CHANNELS.check,
        UPDATE_CHANNELS.install,
    ]) {
        expect(() => invoke(channel, foreign)).toThrow('Refused an IPC call')
    }
})

test('the app version rides in on the preload command line', () => {
    expect(readAppVersionArgument(['electron', '--umber-app-version=0.1.0'])).toBe('0.1.0')
    expect(readAppVersionArgument(['electron', '--sandbox'])).toBeNull()
})
