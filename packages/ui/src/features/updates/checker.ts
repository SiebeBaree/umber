/**
 * The shape a host shell implements so the app can tell whether a newer Umber
 * has been published. Deliberately says nothing about *how* an update is
 * fetched: the desktop shell hands the release to the browser today and may
 * install it in place later, and neither is the UI's business.
 */

export interface UpdateStatus {
    /** The newest published version, or `null` when there is no news. */
    readonly latestVersion: string | null
    /** Whether that version is newer than the running build. */
    readonly available: boolean
}

export interface UpdateChecker {
    check(): Promise<UpdateStatus>
    /** Starts the update, whatever that means for this host. */
    download(): Promise<void>
}

/** What a build with no shell behind it reports: never an update. */
export const NO_UPDATES: UpdateChecker = {
    check: () => Promise.resolve({ latestVersion: null, available: false }),
    download: () => Promise.resolve(),
}
