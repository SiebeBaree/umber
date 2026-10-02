import type { LocalApiRequest, LocalApiResponse } from '@umber/ui/local-api'
import type { WebContents } from 'electron'

import { LOCAL_API_CHANNELS } from '../../shared/local-api'
import { HttpError } from './http'

/** Event-driven RPC to the already running renderer, with no polling when idle. */
export class ApiRenderer {
    private target: WebContents | undefined
    private readonly pending = new Map<
        string,
        {
            resolve: (response: LocalApiResponse) => void
            reject: (error: Error) => void
            timer: ReturnType<typeof setTimeout>
        }
    >()

    ready(target: WebContents): void {
        if (this.target === target) return
        this.disconnect()
        this.target = target
        target.once('destroyed', () => {
            if (this.target === target) this.disconnect()
        })
        target.once('render-process-gone', () => {
            if (this.target === target) this.disconnect()
        })
    }

    disconnect(): void {
        if (this.target !== undefined && !this.target.isDestroyed())
            this.target.setBackgroundThrottling(true)
        this.target = undefined
        for (const entry of this.pending.values()) {
            clearTimeout(entry.timer)
            entry.reject(new Error('The Umber renderer disconnected'))
        }
        this.pending.clear()
    }

    respond(id: string, response: LocalApiResponse, sender: WebContents): void {
        if (sender !== this.target) return
        const pending = this.pending.get(id)
        if (pending === undefined) return
        clearTimeout(pending.timer)
        this.pending.delete(id)
        pending.resolve(response)
        if (this.pending.size === 0) this.target?.setBackgroundThrottling(true)
    }

    dispatch = (request: LocalApiRequest): Promise<LocalApiResponse> => {
        const target = this.target
        if (target === undefined || target.isDestroyed())
            return Promise.reject(
                new HttpError(503, 'window_unavailable', 'Open the Umber window and try again.'),
            )
        if (this.pending.size >= 16)
            return Promise.reject(
                new HttpError(429, 'api_busy', 'Too many requests are in progress.'),
            )
        return new Promise((resolve, reject) => {
            const timer = setTimeout(
                () => {
                    this.pending.delete(request.id)
                    if (this.pending.size === 0 && !target.isDestroyed())
                        target.setBackgroundThrottling(true)
                    reject(new Error('The Umber renderer did not respond'))
                },
                request.action === 'generate' ? 30 * 60_000 : 30_000,
            )
            this.pending.set(request.id, { resolve, reject, timer })
            target.setBackgroundThrottling(false)
            target.send(LOCAL_API_CHANNELS.request, request)
        })
    }
}
