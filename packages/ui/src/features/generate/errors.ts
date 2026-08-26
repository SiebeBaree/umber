/**
 * Thrown for anything the user can act on; `message` is display-ready. Shared
 * by every provider integration, so the composer can tell an actionable
 * failure from a programming error with one `instanceof`.
 *
 * Every message here is written for someone who has never read an API
 * reference. They pasted a key once and typed a sentence; whatever a provider
 * calls its own failure, what reaches them is what it means for their picture
 * and what they can do next.
 */
export class GenerationError extends Error {}

/** One network-failure sentence, phrased the same for every provider. */
export function offlineError(providerName: string): GenerationError {
    return new GenerationError(
        `Umber could not reach ${providerName}. Check your internet connection and try again.`,
    )
}

/**
 * The catch-all for a response nobody planned for.
 *
 * Providers answer with their own error text, written for whoever wrote the
 * integration — parameter names, model ids, quota codes. None of that means
 * anything to the person waiting on a picture, so what the status *implies* is
 * said instead, and the sentence ends with something to do about it.
 */
export function unexpectedError(providerName: string, status: number): GenerationError {
    if (status === 400 || status === 422) {
        return new GenerationError(
            `${providerName} could not work with this request. Try rewording the prompt, or a different size.`,
        )
    }

    if (status === 404) {
        return new GenerationError(
            `${providerName} no longer offers this model. Pick another one and try again.`,
        )
    }

    if (status === 408 || status === 504) {
        return new GenerationError(`${providerName} took too long to answer. Try again.`)
    }

    if (status >= 500) {
        return new GenerationError(
            `${providerName} is having trouble on their end. Try again in a minute.`,
        )
    }

    return new GenerationError(`${providerName} could not make this one. Try again.`)
}

/**
 * The refusal every provider hands back for a prompt it will not make. Their
 * own wording for this ranges from a policy id to a bare `content_violation`,
 * and none of it says the one useful thing: try describing it another way.
 */
export function moderationError(providerName: string): GenerationError {
    return new GenerationError(
        `${providerName} would not make this one. The prompt goes against their content rules, so try describing it differently.`,
    )
}

/** The sentence to show for a thrown value, whatever it turns out to be. */
export function messageOf(error: unknown): string {
    return error instanceof GenerationError
        ? error.message
        : 'Something went wrong while generating. Try again.'
}
