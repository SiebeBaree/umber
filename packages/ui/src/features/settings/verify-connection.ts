import { verifyOpenAiKey, type KeyVerification } from '../generate/openai'
import type { KeyProvider } from './key-providers'

/**
 * Checks credentials against the provider before they are saved, where a
 * checker exists. Providers without one connect on trust and fail at first
 * use instead — worse, which is why checkers are worth adding per provider.
 */
export function verifyConnection(
    provider: KeyProvider,
    credentials: Readonly<Record<string, string>>,
): Promise<KeyVerification> {
    if (provider.id === 'openai') {
        return verifyOpenAiKey(credentials['apiKey']?.trim() ?? '')
    }

    return Promise.resolve({ ok: true })
}
