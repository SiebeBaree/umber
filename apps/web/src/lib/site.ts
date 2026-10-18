import { LABS } from './catalog'

/*
 * The single source of truth for the site's public identity. Every canonical
 * URL, sitemap entry, robots rule, Open Graph tag and llms.txt line derives
 * from these constants.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://umber.s4.nu'

export const SITE_NAME = 'Umber'

export const SITE_TITLE = 'Umber | Free Open Source AI Image & Video Generator'

export const SITE_DESCRIPTION = `Free, open source app for AI images, video and profile photos. Use your own API keys for Google, OpenAI and ${Object.keys(LABS).length - 2} more labs. No subscription.`

export const SLOGAN = 'All the models. None of the subscriptions.'

export const GITHUB_URL = 'https://github.com/SiebeBaree/umber'
export const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`

export const PROVIDERS: readonly string[] = Object.values(LABS)

/** "A, B and C": British style, so no serial comma. */
export const listOf = (items: readonly string[]) =>
    new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(items)
