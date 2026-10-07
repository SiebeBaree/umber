import type { UpdateStatus } from '@umber/ui/updates'
import { app, autoUpdater as nativeUpdater, BrowserWindow, dialog, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

import { UPDATE_CHANNELS } from '../shared/bridge'
import { rendererOnly } from './ipc-guard'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const STARTUP_DELAY_MS = 10_000

/** Runs independently of renderer windows, including when the macOS window is closed. */
class Updates {
    status: UpdateStatus = { state: 'idle', latestVersion: null }
    private checking = false
    private promptedVersion: string | null = null
    private readonly enabled =
        app.isPackaged && (process.platform !== 'linux' || !!process.env['APPIMAGE'])

    private publish(next: UpdateStatus): void {
        this.status = next
        for (const window of BrowserWindow.getAllWindows()) {
            if (!window.webContents.isDestroyed()) {
                window.webContents.send(UPDATE_CHANNELS.changed, this.status)
            }
        }
    }

    private fail = (error: unknown): void => {
        console.warn('Umber update failed', error)
        const message =
            this.status.state === 'installing'
                ? 'The update could not be installed. Try again.'
                : this.status.state === 'checking'
                  ? 'Could not check for updates. Check your connection and try again.'
                  : 'The update could not be prepared. Try again.'
        this.publish({ state: 'error', latestVersion: this.status.latestVersion, message })
    }

    install = (): void => {
        if (!this.enabled || this.status.state !== 'ready') return
        this.publish({ state: 'installing', latestVersion: this.status.latestVersion })
        try {
            autoUpdater.quitAndInstall(false, true)
        } catch (error) {
            this.fail(error)
        }
    }

    private async promptToRestart(version: string): Promise<void> {
        if (this.promptedVersion === version) return
        this.promptedVersion = version
        try {
            const { response } = await dialog.showMessageBox({
                type: 'info',
                title: 'Update ready',
                message: `Umber ${version} is ready to install`,
                detail: 'Restart to apply the update. Wait for any running generations to finish. If you choose Later, the update will install when you quit Umber.',
                buttons: ['Restart now', 'Later'],
                defaultId: 1,
                cancelId: 1,
                noLink: true,
            })
            if (response === 0) this.install()
        } catch (error) {
            // Settings still offers Restart if the native dialog cannot be shown.
            console.warn('Umber could not show the update prompt', error)
        }
    }

    private ready(version: string): void {
        this.publish({ state: 'ready', latestVersion: version })
        void this.promptToRestart(version)
    }

    check = async (): Promise<void> => {
        if (
            !this.enabled ||
            this.checking ||
            this.status.state === 'downloading' ||
            this.status.state === 'ready' ||
            this.status.state === 'installing'
        )
            return

        this.checking = true
        this.publish({ state: 'checking', latestVersion: null })
        try {
            const result = await autoUpdater.checkForUpdates()
            // The check resolves before its automatic download. Observe both
            // promises so download errors cannot become unhandled rejections.
            await result?.downloadPromise
        } catch (error) {
            if (this.status.state !== 'error') this.fail(error)
        } finally {
            this.checking = false
        }
    }

    constructor() {
        if (!this.enabled) return

        autoUpdater.autoDownload = true
        autoUpdater.autoInstallOnAppQuit = true
        autoUpdater.autoRunAppAfterInstall = true
        autoUpdater.allowPrerelease = false
        autoUpdater.allowDowngrade = false
        autoUpdater.on('error', this.fail)
        autoUpdater.on('update-not-available', () =>
            this.publish({ state: 'idle', latestVersion: null }),
        )
        autoUpdater.on('update-available', ({ version }) => {
            this.publish({ state: 'downloading', latestVersion: version, percent: 0 })
        })
        autoUpdater.on('download-progress', ({ percent }) => {
            if (this.status.state !== 'downloading' || !Number.isFinite(percent)) return
            const rounded = Math.max(0, Math.min(100, Math.floor(percent)))
            if (rounded !== this.status.percent) this.publish({ ...this.status, percent: rounded })
        })
        autoUpdater.on('update-downloaded', ({ version }) => {
            // On macOS this event precedes Squirrel's signature verification.
            // Keep showing preparation until the native updater confirms readiness.
            if (process.platform === 'darwin') {
                this.publish({ state: 'downloading', latestVersion: version, percent: 100 })
            } else {
                this.ready(version)
            }
        })
        if (process.platform === 'darwin') {
            nativeUpdater.on('update-downloaded', () => {
                if (this.status.state === 'downloading') this.ready(this.status.latestVersion)
            })
        }

        const startup = setTimeout(() => void this.check(), STARTUP_DELAY_MS)
        const interval = setInterval(() => void this.check(), CHECK_INTERVAL_MS)
        app.once('before-quit', () => {
            clearTimeout(startup)
            clearInterval(interval)
        })
    }
}

/** Runs independently of renderer windows, including when the macOS window is closed. */
export function registerUpdatesIpc(): void {
    const updates = new Updates()
    ipcMain.handle(
        UPDATE_CHANNELS.status,
        rendererOnly(() => updates.status),
    )
    ipcMain.handle(UPDATE_CHANNELS.check, rendererOnly(updates.check))
    ipcMain.handle(UPDATE_CHANNELS.install, rendererOnly(updates.install))
}
