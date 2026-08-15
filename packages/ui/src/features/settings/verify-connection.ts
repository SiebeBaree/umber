import { verifyBflKey } from '../generate/bfl'
import { verifyGoogleKey } from '../generate/google'
import { verifyOpenAiKey, type KeyVerification } from '../generate/openai'
import { verifyRecraftKey } from '../generate/recraft'
import { verifyRunwayKey } from '../generate/runway'
import { verifyXaiKey } from '../generate/xai'
import type { KeyProvider } from './key-providers'

/**
 * Checks credentials against the provider before they are saved, where the
 * provider offers a free authenticated call to check against. Providers
 * without one connect on trust and fail at first use instead — worse, which
 * is why checkers are worth adding as vendors grow them.
 */

type Verifier = (apiKey: string) => Promise<KeyVerification>

const VERIFIERS: Readonly<Record<string, Verifier>> = {
    openai: verifyOpenAiKey,
    google: verifyGoogleKey,
    blackForestLabs: verifyBflKey,
    recraft: verifyRecraftKey,
    runway: verifyRunwayKey,
    xai: verifyXaiKey,
}

export function verifyConnection(
    provider: KeyProvider,
    credentials: Readonly<Record<string, string>>,
): Promise<KeyVerification> {
    const verify = VERIFIERS[provider.id]

    if (verify !== undefined) {
        return verify(credentials['apiKey']?.trim() ?? '')
    }

    return Promise.resolve({ ok: true })
}
