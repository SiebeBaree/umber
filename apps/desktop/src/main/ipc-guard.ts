import type { IpcMainInvokeEvent } from 'electron'

import { isRendererUrl } from './security'

/**
 * Who is allowed to call the shell.
 *
 * The preload bridge is attached to a `webContents`, not to an origin, so any
 * document that ends up loaded in the window would inherit it. `index.ts`
 * refuses those navigations outright; this is the second lock on the same door,
 * checking at the handler that the frame asking for a credential really is the
 * app's own document. Cheap enough to be worth having twice, given what is
 * behind it.
 */

let rendererUrl = ''

/** Called once at startup with the URL the window is about to load. */
export function trustRendererUrl(url: string): void {
    rendererUrl = url
}

function fromRenderer(event: IpcMainInvokeEvent): boolean {
    try {
        // Null once the frame has gone away, which is not a caller we serve.
        const url = event.senderFrame?.url

        return typeof url === 'string' && isRendererUrl(url, rendererUrl)
    } catch {
        return false
    }
}

/**
 * Wraps an IPC handler so it only ever runs for the app's own document. The
 * handler itself never sees the event, which keeps the argument shapes the
 * same on both sides of the bridge.
 */
export function rendererOnly<Arguments extends readonly unknown[], Result>(
    handler: (...args: Arguments) => Result,
): (event: IpcMainInvokeEvent, ...args: Arguments) => Result {
    return (event, ...args) => {
        if (!fromRenderer(event)) {
            throw new Error('Refused an IPC call from outside the Umber document')
        }

        return handler(...args)
    }
}
