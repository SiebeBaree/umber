import type { LocalApiStatus } from '@umber/ui/local-api'

import type { Dispatch } from './jobs'
import { writePreferences, type ApiPreferences } from './preferences'
import { LocalApiServer } from './server'

const PORT = 19432

/** Serializes settings writes and listener changes so rapid toggles cannot race. */
export class ApiController {
    private readonly server: LocalApiServer
    private listening = false
    private error: string | null = null
    private queue: Promise<unknown> = Promise.resolve()

    constructor(
        private readonly path: string,
        private preferences: ApiPreferences,
        docs: string,
        dispatch: Dispatch,
        private readonly changed: (status: LocalApiStatus) => void,
    ) {
        this.server = new LocalApiServer({ port: PORT, docs, dispatch })
    }

    status = (): LocalApiStatus => ({
        ...this.preferences,
        listening: this.listening,
        baseUrl: `http://127.0.0.1:${PORT}`,
        error: this.error,
    })

    ready = () => this.serialize(() => this.synchronize())

    setEnabled = (enabled: unknown) =>
        this.serialize(async () => {
            if (typeof enabled !== 'boolean') throw new Error('Enabled must be a boolean')
            const next = { ...this.preferences, enabled }
            await writePreferences(this.path, next)
            this.preferences = next
            return this.synchronize()
        })

    reset = () =>
        this.serialize(async () => {
            // Stop admission before checking work in flight. Otherwise a request can
            // start during the settings write and repopulate an erased gallery.
            await this.server.stop()
            this.listening = false
            try {
                if (this.server.busy)
                    throw new Error('Wait for the API generation to finish before erasing data.')
                const next = { enabled: false }
                await writePreferences(this.path, next)
                this.server.clearJobs()
                this.preferences = next
            } catch (error: unknown) {
                await this.synchronize()
                throw error
            }
            return this.synchronize()
        })

    get busy(): boolean {
        return this.server.busy
    }

    stop = () => this.server.stop()

    private serialize<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.queue.then(operation)
        this.queue = result.catch(() => null)
        return result
    }

    private async synchronize(): Promise<LocalApiStatus> {
        this.error = null
        if (this.preferences.enabled) {
            try {
                await this.server.start()
                this.listening = true
            } catch {
                this.listening = false
                this.error = `Could not listen on port ${PORT}. Close the app using it, then turn the API off and on.`
            }
        } else {
            await this.server.stop()
            this.listening = false
        }
        this.changed(this.status())
        return this.status()
    }
}
