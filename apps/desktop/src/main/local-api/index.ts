import { join } from 'node:path'

import type { LocalApiResponse } from '@umber/ui/local-api'
import { app, BrowserWindow, ipcMain } from 'electron'

import docs from '../../../../../docs/LOCAL_API.md?raw'
import { LOCAL_API_CHANNELS } from '../../shared/local-api'
import { rendererOnly } from '../ipc-guard'
import { ApiController } from './controller'
import { readPreferences } from './preferences'
import { ApiRenderer } from './renderer'

export async function registerLocalApiIpc() {
    const path = join(app.getPath('userData'), 'local-api.json')
    const renderer = new ApiRenderer()
    const controller = new ApiController(
        path,
        await readPreferences(path),
        docs,
        renderer.dispatch,
        (status) => {
            for (const window of BrowserWindow.getAllWindows())
                window.webContents.send(LOCAL_API_CHANNELS.changed, status)
        },
    )
    ipcMain.handle(LOCAL_API_CHANNELS.status, rendererOnly(controller.status))
    ipcMain.handle(LOCAL_API_CHANNELS.enable, rendererOnly(controller.setEnabled))
    ipcMain.handle(LOCAL_API_CHANNELS.reset, rendererOnly(controller.reset))
    ipcMain.handle(LOCAL_API_CHANNELS.ready, (event, ready: unknown) =>
        rendererOnly(() => {
            if (ready === true) {
                renderer.ready(event.sender)
                return controller.ready()
            }
            renderer.disconnect()
            return controller.status()
        })(event),
    )
    ipcMain.handle(LOCAL_API_CHANNELS.response, (event, id: string, response: LocalApiResponse) =>
        rendererOnly(() => {
            renderer.respond(id, response, event.sender)
        })(event),
    )
    app.on('before-quit', () => {
        renderer.disconnect()
        void controller.stop()
    })
    return { keepWindow: () => controller.status().enabled || controller.busy }
}
