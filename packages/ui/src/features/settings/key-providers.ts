import { PROVIDERS, type ProviderId } from '../create/catalog'

/**
 * Everything the settings page knows about connecting a provider: the model
 * catalog says what each vendor's models can *do*; this file says what Umber
 * has to *ask the user for* before it may call them. Most vendors need one
 * API key, but not all — Kling signs with a key pair, MiniMax scopes calls to
 * a group, Alibaba issues region-locked keys — so each provider declares its
 * own credential fields and the add dialog renders whatever is declared.
 * Aggregators sit on top: one key that resells many vendors' models.
 */

export type KeyProviderId = ProviderId | 'fal' | 'higgsfield'

interface CredentialFieldBase {
    readonly id: string
    readonly label: string
    /** One line under the field for anything the label cannot carry alone. */
    readonly hint?: string
}

export type CredentialField =
    /** A secret, rendered masked with a reveal toggle. */
    | (CredentialFieldBase & { readonly kind: 'secret'; readonly placeholder: string })
    /** A plain identifier that is not worth hiding, like an account or group id. */
    | (CredentialFieldBase & { readonly kind: 'text'; readonly placeholder: string })
    /** A small closed choice, like which regional endpoint a key belongs to. */
    | (CredentialFieldBase & {
          readonly kind: 'choice'
          readonly options: readonly [
              { readonly value: string; readonly label: string },
              ...{ readonly value: string; readonly label: string }[],
          ]
      })

/**
 * One thing to do in the provider's console before the key will work. Some
 * vendors need more than "create a key" — verification, prepaid billing — and
 * hiding those would just move the failure to the first generation.
 */
export interface SetupStep {
    readonly title: string
    /** One line on what to do there, or why the step exists. */
    readonly detail: string
    /** Where the step happens, opened in the system browser. */
    readonly url?: string
}

export interface KeyProvider {
    readonly id: KeyProviderId
    readonly name: string
    /** Vendors sell their own models; aggregators resell many vendors' models. */
    readonly group: 'vendor' | 'aggregator'
    /** What connecting this provider switches on, in model names the user knows. */
    readonly unlocks: string
    /** Where the credentials come from, opened in the system browser. */
    readonly console: { readonly label: string; readonly url: string }
    /**
     * Everything to do in the console before pasting, in order. Providers
     * without their own list get a single derived "create a key" step.
     */
    readonly setup?: readonly [SetupStep, ...SetupStep[]]
    /** Ordered as the form shows them; the first field is always the key itself. */
    readonly fields: readonly [CredentialField, ...CredentialField[]]
    /** A provider quirk worth a sentence in the dialog, if there is one. */
    readonly note?: string
}

const API_KEY = 'apiKey'

/** The one-field shape almost every vendor uses. */
function apiKeyField(placeholder: string, hint?: string): CredentialField {
    return {
        kind: 'secret',
        id: API_KEY,
        label: 'API key',
        placeholder,
        ...(hint === undefined ? {} : { hint }),
    }
}

export const KEY_PROVIDERS: readonly KeyProvider[] = [
    {
        id: 'google',
        name: PROVIDERS.google.name,
        group: 'vendor',
        unlocks: 'Nano Banana and Veo',
        console: { label: 'Google AI Studio', url: 'https://aistudio.google.com/apikey' },
        fields: [apiKeyField('AIza…')],
    },
    {
        id: 'openai',
        name: PROVIDERS.openai.name,
        group: 'vendor',
        unlocks: 'GPT Image and Sora',
        console: { label: 'OpenAI platform', url: 'https://platform.openai.com/api-keys' },
        setup: [
            {
                title: 'Create an API key',
                detail: 'Create a secret key and copy it right away. OpenAI shows it only once.',
                url: 'https://platform.openai.com/api-keys',
            },
            {
                title: 'Verify your organisation',
                detail: 'GPT Image models stay hidden until the organisation behind the key is verified. Takes a few minutes with a photo ID.',
                url: 'https://platform.openai.com/settings/organization/general',
            },
            {
                title: 'Add billing credit',
                detail: 'API usage is prepaid and separate from ChatGPT. $5 goes a long way.',
                url: 'https://platform.openai.com/settings/organization/billing/overview',
            },
        ],
        fields: [apiKeyField('sk-proj-…')],
        note: 'Umber checks the key with OpenAI when you connect.',
    },
    {
        id: 'blackForestLabs',
        name: PROVIDERS.blackForestLabs.name,
        group: 'vendor',
        unlocks: 'The FLUX image family',
        console: { label: 'BFL API portal', url: 'https://api.bfl.ai' },
        fields: [apiKeyField('Your BFL API key')],
    },
    {
        id: 'stability',
        name: PROVIDERS.stability.name,
        group: 'vendor',
        unlocks: 'Stable Image and SD 3.5',
        console: {
            label: 'Stability AI platform',
            url: 'https://platform.stability.ai/account/keys',
        },
        fields: [apiKeyField('sk-…')],
    },
    {
        id: 'ideogram',
        name: PROVIDERS.ideogram.name,
        group: 'vendor',
        unlocks: 'Ideogram V3 and 4.0',
        console: { label: 'Ideogram API settings', url: 'https://ideogram.ai/manage-api' },
        fields: [apiKeyField('Your Ideogram API key')],
    },
    {
        id: 'recraft',
        name: PROVIDERS.recraft.name,
        group: 'vendor',
        unlocks: 'Recraft V4.1 and V3',
        console: { label: 'Recraft profile', url: 'https://www.recraft.ai/profile/api' },
        fields: [apiKeyField('Your Recraft API key')],
    },
    {
        id: 'runway',
        name: PROVIDERS.runway.name,
        group: 'vendor',
        unlocks: 'Gen-4.5 video and Gen-4 Image',
        setup: [
            {
                title: 'Create an API key',
                detail: 'Keys live in the developer portal, separate from the Runway app.',
                url: 'https://dev.runwayml.com',
            },
            {
                title: 'Buy API credits',
                detail: 'API credits are prepaid and separate from a Runway app subscription.',
                url: 'https://dev.runwayml.com',
            },
        ],
        console: { label: 'Runway developer portal', url: 'https://dev.runwayml.com' },
        fields: [apiKeyField('key_…')],
    },
    {
        id: 'luma',
        name: PROVIDERS.luma.name,
        group: 'vendor',
        unlocks: 'Ray video and Uni images',
        console: { label: 'Luma platform', url: 'https://platform.lumalabs.ai' },
        fields: [apiKeyField('luma-…')],
    },
    {
        id: 'kuaishou',
        name: PROVIDERS.kuaishou.name,
        group: 'vendor',
        unlocks: 'Kling video and images',
        console: { label: 'Kling AI open platform', url: 'https://app.klingai.com' },
        fields: [
            {
                kind: 'secret',
                id: 'accessKey',
                label: 'Access key',
                placeholder: 'Your access key',
            },
            {
                kind: 'secret',
                id: 'secretKey',
                label: 'Secret key',
                placeholder: 'Your secret key',
            },
        ],
        note: 'Kling signs every request with a key pair, so both parts are needed.',
    },
    {
        id: 'minimax',
        name: PROVIDERS.minimax.name,
        group: 'vendor',
        unlocks: 'Hailuo video and Image-01',
        console: {
            label: 'MiniMax platform',
            url: 'https://platform.minimax.io/user-center/basic-information/interface-key',
        },
        fields: [apiKeyField('eyJhbGci…')],
    },
    {
        id: 'bytedance',
        name: PROVIDERS.bytedance.name,
        group: 'vendor',
        unlocks: 'Seedream images and Seedance video',
        console: { label: 'BytePlus ModelArk', url: 'https://console.byteplus.com/ark' },
        fields: [apiKeyField('Your ModelArk API key')],
    },
    {
        id: 'alibaba',
        name: PROVIDERS.alibaba.name,
        group: 'vendor',
        unlocks: 'Qwen Image and Wan video',
        console: {
            label: 'Alibaba Cloud Model Studio',
            url: 'https://modelstudio.console.alibabacloud.com',
        },
        fields: [
            apiKeyField('sk-…'),
            {
                kind: 'choice',
                id: 'region',
                label: 'Key region',
                options: [
                    { value: 'international', label: 'International' },
                    { value: 'china', label: 'Mainland China' },
                ],
                hint: 'Model Studio keys are region-locked, so pick where yours was created.',
            },
        ],
    },
    {
        id: 'pixverse',
        name: PROVIDERS.pixverse.name,
        group: 'vendor',
        unlocks: 'PixVerse video',
        console: { label: 'PixVerse platform', url: 'https://platform.pixverse.ai' },
        fields: [apiKeyField('Your PixVerse API key')],
    },
    {
        id: 'lightricks',
        name: PROVIDERS.lightricks.name,
        group: 'vendor',
        unlocks: 'LTX-2.5 video',
        console: { label: 'LTX console', url: 'https://console.ltx.io' },
        fields: [apiKeyField('Your LTX API key')],
    },
    {
        id: 'fal',
        name: 'Fal.ai',
        group: 'aggregator',
        unlocks: 'Most of the catalog, hosted on Fal',
        console: { label: 'Fal dashboard', url: 'https://fal.ai/dashboard/keys' },
        fields: [
            apiKeyField(
                'key-id:key-secret',
                'Fal issues the id and secret as one colon-joined key.',
            ),
        ],
        note: 'One Fal key runs models from many vendors at once, without a dozen separate accounts.',
    },
    {
        id: 'higgsfield',
        name: 'Higgsfield',
        group: 'aggregator',
        unlocks: 'Soul images plus hosted partner models',
        console: { label: 'Higgsfield platform', url: 'https://higgsfield.ai' },
        fields: [apiKeyField('Your Higgsfield API key')],
    },
]

export function findKeyProvider(id: KeyProviderId): KeyProvider {
    const provider = KEY_PROVIDERS.find((candidate) => candidate.id === id)

    if (provider === undefined) {
        // Unreachable while `KEY_PROVIDERS` covers the union above, which the
        // add dialog is the only thing handing out ids from.
        throw new Error(`Unknown key provider: ${id}`)
    }

    return provider
}

/** What the add dialog hands back on connect: the entered credentials, keyed
 * by field id, on their way to the vault. Nothing else keeps them. */
export interface NewConnection {
    readonly providerId: KeyProviderId
    readonly credentials: Readonly<Record<string, string>>
}
