/** What local programs may generate. One of the two kinds is always allowed while the API is on. */
export type LocalApiAccess = 'images' | 'videos' | 'both'

export type LocalApiKind = 'image' | 'video'

/** A rolling window in days, or null to count every API request ever made. */
export type LimitPeriod = 1 | 7 | 30 | null

/** API requests are rejected once their estimates would pass `usd` within `days`. */
export interface SpendingLimit {
    readonly usd: number
    readonly days: LimitPeriod
}

/** What the shell persists. No provider credentials ever travel through this API. */
export interface LocalApiSettings {
    readonly enabled: boolean
    readonly access: LocalApiAccess
    readonly limits: readonly SpendingLimit[]
}

/** A limit with the estimated API spend it has counted so far. */
export interface LimitUsage extends SpendingLimit {
    readonly spent: number
}

/** Shell-owned listener state, as the settings page shows it. */
export interface LocalApiStatus extends Omit<LocalApiSettings, 'limits'> {
    readonly limits: readonly LimitUsage[]
    readonly listening: boolean
    readonly baseUrl: string
    readonly error: string | null
}

export type LocalApiRequest =
    | {
          readonly id: string
          readonly action: 'models'
          readonly body: { readonly kinds: readonly LocalApiKind[] }
      }
    | {
          readonly id: string
          readonly action: 'estimate' | 'generate' | 'read' | 'file'
          readonly kind: LocalApiKind
          readonly body: unknown
      }

export type LocalApiResponse =
    | { readonly status: number; readonly body: unknown }
    | { readonly status: 200; readonly bytes: Uint8Array; readonly mediaType: string }

export interface LocalApiBridge {
    status(): Promise<LocalApiStatus>
    /** Persists any subset of the settings; the shell validates and answers with the new status. */
    update(patch: Partial<LocalApiSettings>): Promise<LocalApiStatus>
    reset(): Promise<LocalApiStatus>
    onStatus(listener: (status: LocalApiStatus) => void): () => void
    /** Attaches the existing generation engine and storage to the shell's listener. */
    handle(handler: (request: LocalApiRequest) => Promise<LocalApiResponse>): () => void
}
