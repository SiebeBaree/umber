import { PROVIDERS, type ProviderId } from '../create/catalog'

/**
 * Everything the settings page knows about connecting a provider: the model
 * catalog says what each vendor's models can *do*, this file says what Umber
 * has to *ask the user for* before it may call them. Most vendors need one API
 * key, but not all. Kling signs with a key pair and Alibaba issues
 * region-locked keys, so each provider declares its own credential fields and
 * the add dialog renders whatever is declared.
 */

export type KeyProviderId = ProviderId

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
 * vendors need more than "create a key", like verification, prepaid billing or
 * activating a model, and hiding those would just move the failure to the first
 * generation.
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
        unlocks: 'Nano Banana and Veo',
        console: { label: 'Google AI Studio', url: 'https://aistudio.google.com/apikey' },
        setup: [
            {
                title: 'Create an API key',
                detail: 'Keys are created in AI Studio and work straight away for image models.',
                url: 'https://aistudio.google.com/apikey',
            },
            {
                title: 'Enable billing for Veo',
                detail: 'Veo has no free tier. Video generation needs a key on a paid-tier project.',
            },
        ],
        fields: [apiKeyField('AIza…')],
        note: 'Umber checks the key with Google when you connect.',
    },
    {
        id: 'openai',
        name: PROVIDERS.openai.name,
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
        unlocks: 'The FLUX image family',
        console: { label: 'BFL dashboard', url: 'https://dashboard.bfl.ai' },
        setup: [
            {
                title: 'Create an API key',
                detail: 'Copy the key as soon as it appears. BFL shows it only once.',
                url: 'https://dashboard.bfl.ai',
            },
            {
                title: 'Add credits',
                detail: 'API usage is prepaid. Credits are bought in the same dashboard.',
                url: 'https://dashboard.bfl.ai',
            },
        ],
        fields: [apiKeyField('Your BFL API key')],
    },
    {
        id: 'ideogram',
        name: PROVIDERS.ideogram.name,
        unlocks: 'Ideogram 4.0 and V3',
        console: { label: 'Ideogram API settings', url: 'https://ideogram.ai/manage-api' },
        fields: [apiKeyField('Your Ideogram API key')],
    },
    {
        id: 'recraft',
        name: PROVIDERS.recraft.name,
        unlocks: 'Recraft V4.1 and V3',
        console: { label: 'Recraft API settings', url: 'https://app.recraft.ai/profile/api' },
        setup: [
            {
                title: 'Buy API units',
                detail: 'Recraft only issues a key once the account has a positive API unit balance.',
                url: 'https://app.recraft.ai/profile/api',
            },
            {
                title: 'Create an API key',
                detail: 'Keys live under the API tab of your Recraft profile.',
                url: 'https://app.recraft.ai/profile/api',
            },
        ],
        fields: [apiKeyField('Your Recraft API key')],
    },
    {
        id: 'runway',
        name: PROVIDERS.runway.name,
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
        id: 'kuaishou',
        name: PROVIDERS.kuaishou.name,
        unlocks: 'Kling video and images',
        console: { label: 'Kling developer console', url: 'https://kling.ai/dev' },
        setup: [
            {
                title: 'Create a key pair',
                detail: 'The developer console issues an access key and a secret key together.',
                url: 'https://kling.ai/dev/api-key',
            },
            {
                title: 'Buy a resource package',
                detail: 'Calls fail until the account holds an image or video package. There is a trial package.',
                url: 'https://kling.ai/dev',
            },
        ],
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
        id: 'bytedance',
        name: PROVIDERS.bytedance.name,
        unlocks: 'Seedream images and Seedance video',
        console: { label: 'BytePlus ModelArk', url: 'https://console.byteplus.com/ark' },
        setup: [
            {
                title: 'Create an API key',
                detail: 'Keys are made in the ModelArk console.',
                url: 'https://console.byteplus.com/ark',
            },
            {
                title: 'Activate the models',
                detail: 'ModelArk gates each model separately. Activate Seedream and Seedance before generating.',
                url: 'https://console.byteplus.com/ark',
            },
        ],
        fields: [apiKeyField('Your ModelArk API key')],
        note: 'Seedance 2.0 also needs a balance over $30 or a Seedance resource pack.',
    },
    {
        id: 'alibaba',
        name: PROVIDERS.alibaba.name,
        unlocks: 'Qwen Image and Wan video',
        console: {
            label: 'Alibaba Cloud Model Studio',
            url: 'https://modelstudio.console.alibabacloud.com',
        },
        setup: [
            {
                title: 'Activate Model Studio',
                detail: 'The service has to be activated once on the account before any key works.',
                url: 'https://modelstudio.console.alibabacloud.com',
            },
            {
                title: 'Create an API key',
                detail: 'Keys belong to the region they were made in, which the field below asks for.',
                url: 'https://modelstudio.console.alibabacloud.com',
            },
        ],
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
