/** The main process owns downloads and installation; the UI observes its state. */
export type UpdateStatus =
    | { readonly state: 'idle' | 'checking'; readonly latestVersion: null }
    | {
          readonly state: 'downloading'
          readonly latestVersion: string
          readonly percent: number
      }
    | { readonly state: 'ready' | 'installing'; readonly latestVersion: string }
    | {
          readonly state: 'error'
          readonly latestVersion: string | null
          readonly message: string
      }

export interface UpdateChecker {
    status(): Promise<UpdateStatus>
    check(): Promise<void>
    install(): Promise<void>
    onStatus(listener: (status: UpdateStatus) => void): () => void
}

/** Browser previews have no installed app to update. */
export const NO_UPDATES: UpdateChecker = {
    status: () => Promise.resolve({ state: 'idle', latestVersion: null }),
    check: () => Promise.resolve(),
    install: () => Promise.resolve(),
    onStatus: () => () => {},
}
