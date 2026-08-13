/**
 * Thrown for anything the user can act on; `message` is display-ready. Shared
 * by every provider integration, so the composer can tell an actionable
 * failure from a programming error with one `instanceof`.
 */
export class GenerationError extends Error {}

/** One network-failure sentence, phrased the same for every provider. */
export function offlineError(providerName: string): GenerationError {
    return new GenerationError(
        `Could not reach ${providerName}. Check your connection and try again.`,
    )
}
