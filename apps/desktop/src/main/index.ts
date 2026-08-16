import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { app, BrowserWindow, session, shell, type Event } from 'electron'

import { trustRendererUrl } from './ipc-guard'
import { registerNetIpc } from './net'
import { CONTENT_SECURITY_POLICY, isAllowedExternalUrl, isRendererUrl } from './security'
import { registerUpdatesIpc } from './updates'
import { registerVaultIpc } from './vault'
import { createWindowOptions } from './window'

const APP_USER_MODEL_ID = 'com.umber.app'

/** Set by `electron-vite dev`; absent in a packaged build. */
const rendererDevServerUrl = process.env['ELECTRON_RENDERER_URL']
const isDev = rendererDevServerUrl !== undefined

/** The one document the window is ever allowed to hold. */
function rendererUrl(): string {
    return rendererDevServerUrl ?? pathToFileURL(join(__dirname, '../renderer/index.html')).href
}

function applyContentSecurityPolicy(): void {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [CONTENT_SECURITY_POLICY],
            },
        })
    })
}

/**
 * Pins the window to the app's own document.
 *
 * Without this the window will follow anything that asks it to navigate — a
 * link or a file dropped onto the page, a redirect off a request — and since
 * the preload is attached to the `webContents` rather than to an origin, the
 * page that landed there would be handed the vault. There is nowhere in Umber
 * that legitimately navigates the top frame: routes are hash changes, which do
 * not raise these events, and outside links open in the browser.
 */
function pinToRenderer(window: BrowserWindow, appUrl: string): void {
    const guard = (event: Event, url: string) => {
        if (isRendererUrl(url, appUrl)) {
            return
        }

        console.warn('Refused to navigate the window to', url)
        event.preventDefault()
    }

    window.webContents.on('will-navigate', guard)
    window.webContents.on('will-redirect', guard)
}

function createMainWindow(): BrowserWindow {
    const window = new BrowserWindow(
        createWindowOptions(join(__dirname, '../preload/index.js'), app.getVersion()),
    )

    // Avoid the white flash: reveal the window only once React has painted.
    window.on('ready-to-show', () => {
        window.show()
    })

    // Never open a second Electron window for a link; hand https: to the browser.
    window.webContents.setWindowOpenHandler(({ url }) => {
        if (isAllowedExternalUrl(url)) {
            void shell.openExternal(url)
        }
        return { action: 'deny' }
    })

    const appUrl = rendererUrl()
    pinToRenderer(window, appUrl)
    void window.loadURL(appUrl)

    return window
}

async function start(): Promise<void> {
    await app.whenReady()

    app.setAppUserModelId(APP_USER_MODEL_ID)

    if (!isDev) {
        applyContentSecurityPolicy()
    }

    // Before any handler is registered: the guards read it on every call.
    trustRendererUrl(rendererUrl())

    registerVaultIpc()
    registerNetIpc()
    registerUpdatesIpc()
    createMainWindow()

    // macOS: clicking the dock icon with no windows open reopens one.
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow()
        }
    })
}

start().catch((error: unknown) => {
    console.error('Umber failed to start', error)
    app.quit()
})

app.on('window-all-closed', () => {
    // macOS apps conventionally stay alive after the last window closes.
    if (process.platform !== 'darwin') {
        app.quit()
    }
})
