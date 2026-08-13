import { join } from 'node:path'

import { app, BrowserWindow, session, shell } from 'electron'

import { registerNetIpc } from './net'
import { CONTENT_SECURITY_POLICY, isAllowedExternalUrl } from './security'
import { registerVaultIpc } from './vault'
import { createWindowOptions } from './window'

const APP_USER_MODEL_ID = 'com.umber.app'

/** Set by `electron-vite dev`; absent in a packaged build. */
const rendererDevServerUrl = process.env['ELECTRON_RENDERER_URL']
const isDev = rendererDevServerUrl !== undefined

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

function createMainWindow(): BrowserWindow {
    const window = new BrowserWindow(createWindowOptions(join(__dirname, '../preload/index.js')))

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

    if (rendererDevServerUrl === undefined) {
        void window.loadFile(join(__dirname, '../renderer/index.html'))
    } else {
        void window.loadURL(rendererDevServerUrl)
    }

    return window
}

async function start(): Promise<void> {
    await app.whenReady()

    app.setAppUserModelId(APP_USER_MODEL_ID)

    if (!isDev) {
        applyContentSecurityPolicy()
    }

    registerVaultIpc()
    registerNetIpc()
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
