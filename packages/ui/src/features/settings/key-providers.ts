import { PROVIDERS, type ProviderId } from '../create/catalog'

/**
 * Everything the settings page knows about connecting a provider.
 *
 * The model catalog says what each vendor's models can *do*; this file says
 * what Umber has to *ask the user for* before it may call them. Most vendors
 * need exactly one API key, but not all: Kling signs requests with a key
 * pair, MiniMax scopes every call to a group, Alibaba issues region-locked
 * keys. So each provider declares its own credential fields and the add
 * dialog renders whatever is declared.
 *
 * On top of the catalog vendors sit aggregators: services that resell many
 * vendors' models behind one key, for people who would rather not open a
 * dozen accounts.
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

export interface KeyProvider {
    readonly id: KeyProviderId
    readonly name: string
    /** Vendors sell their own models; aggregators resell many vendors' models. */
    readonly group: 'vendor' | 'aggregator'
    /** What connecting this provider switches on, in model names the user knows. */
    readonly unlocks: string
    /** Where the credentials come from, opened in the system browser. */
    readonly console: { readonly label: string; readonly url: string }
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
        unlocks: 'Nano Banana, Imagen and Veo',
        console: { label: 'Google AI Studio', url: 'https://aistudio.google.com/apikey' },
        fields: [apiKeyField('AIza…')],
    },
    {
        id: 'openai',
        name: PROVIDERS.openai.name,
        group: 'vendor',
        unlocks: 'GPT Image and Sora',
        console: { label: 'OpenAI platform', url: 'https://platform.openai.com/api-keys' },
        fields: [apiKeyField('sk-proj-…')],
        note: 'Sora needs a verified organisation on your OpenAI account; images work on any key.',
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
        unlocks: 'Stable Diffusion 3.5',
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
        unlocks: 'Ideogram V3',
        console: { label: 'Ideogram API settings', url: 'https://ideogram.ai/manage-api' },
        fields: [apiKeyField('Your Ideogram API key')],
    },
    {
        id: 'recraft',
        name: PROVIDERS.recraft.name,
        group: 'vendor',
        unlocks: 'Recraft V3',
        console: { label: 'Recraft profile', url: 'https://www.recraft.ai/profile/api' },
        fields: [apiKeyField('Your Recraft API key')],
    },
    {
        id: 'runway',
        name: PROVIDERS.runway.name,
        group: 'vendor',
        unlocks: 'Gen-4.5 video and Gen-4 Image',
        console: { label: 'Runway developer portal', url: 'https://dev.runwayml.com' },
        fields: [apiKeyField('key_…')],
        note: 'Runway API credits are separate from a Runway app subscription.',
    },
    {
        id: 'luma',
        name: PROVIDERS.luma.name,
        group: 'vendor',
        unlocks: 'Ray 3 video and Photon 2 images',
        console: { label: 'Luma API dashboard', url: 'https://lumalabs.ai/api/keys' },
        fields: [apiKeyField('luma-…')],
    },
    {
        id: 'kuaishou',
        name: PROVIDERS.kuaishou.name,
        group: 'vendor',
        unlocks: 'The Kling video family',
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
        unlocks: 'Hailuo video',
        console: {
            label: 'MiniMax platform',
            url: 'https://platform.minimax.io/user-center/basic-information/interface-key',
        },
        fields: [
            apiKeyField('eyJhbGci…'),
            {
                kind: 'text',
                id: 'groupId',
                label: 'Group ID',
                placeholder: '1234567890123456789',
                hint: 'Shown next to your key in the MiniMax console; every call is scoped to it.',
            },
        ],
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
        unlocks: 'LTX-2 video',
        console: { label: 'LTX Studio', url: 'https://ltx.studio' },
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

/**
 * What the add dialog hands back on connect. Only the tail of the key
 * survives, enough for "which key is this" without keeping the secret around
 * in state.
 */
export interface NewConnection {
    readonly providerId: KeyProviderId
    /** The last few characters of the key, for display as `···· 4f2a`. */
    readonly keyTail: string
}

/** A connected provider as the settings page tracks it. */
export interface ProviderConnection {
    readonly providerId: KeyProviderId
    /** The last few characters of the key, for display as `…· 4f2a`. */
    readonly keyTail: string
    /** Already formatted for display, e.g. "13 Aug 2026". */
    readonly addedOn: string
}
