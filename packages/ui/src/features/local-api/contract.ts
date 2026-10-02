/** Shell-owned listener. No provider credentials ever travel through this API. */
export interface LocalApiStatus {
    readonly enabled: boolean
    readonly listening: boolean
    readonly baseUrl: string
    readonly error: string | null
}

export interface LocalApiRequest {
    readonly id: string
    readonly action: 'models' | 'estimate' | 'generate' | 'image' | 'file'
    readonly body: unknown
}

export type LocalApiResponse =
    | { readonly status: number; readonly body: unknown }
    | { readonly status: 200; readonly bytes: Uint8Array; readonly mediaType: string }

export interface LocalApiBridge {
    status(): Promise<LocalApiStatus>
    setEnabled(enabled: boolean): Promise<LocalApiStatus>
    reset(): Promise<LocalApiStatus>
    onStatus(listener: (status: LocalApiStatus) => void): () => void
    /** Attaches the existing image engine and storage to the shell's listener. */
    handle(handler: (request: LocalApiRequest) => Promise<LocalApiResponse>): () => void
}
