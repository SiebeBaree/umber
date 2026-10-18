import { countOf } from '../lib/catalog'
import { getLatestRelease, type Release } from '../lib/release'
import {
    GITHUB_URL,
    LICENSE_URL,
    listOf,
    PROVIDERS,
    SITE_DESCRIPTION,
    SITE_NAME,
    SITE_URL,
} from '../lib/site'
import { Develop } from './_components/develop'
import { FaqItem } from './_components/faq-item'
import { Finale } from './_components/finale'
import { Hero } from './_components/hero'
import { ModelsIndex } from './_components/models-index'
import { Nav } from './_components/nav'
import { Pricing } from './_components/pricing'
import { Reel } from './_components/reel'
import { ReleaseLine } from './_components/release-line'
import { Templates } from './_components/templates'
import { ThemeShift } from './_components/theme-shift'

// One list feeds both the FAQ section and its structured data, so what
// Google reads always matches what the page shows.
const FAQ_ITEMS = [
    {
        q: 'Is Umber really free?',
        a: 'Yes. The app is free and open source under the MIT license. You pay the AI labs for what you generate, at their own prices, and Umber adds nothing on top.',
    },
    {
        q: 'Which labs can I connect?',
        a: `${listOf(PROVIDERS)}. One key is enough to start.`,
    },
    {
        q: 'Can you see my keys, prompts or images?',
        a: "No. There is no Umber server. Keys are encrypted with your operating system's keychain, requests go straight from your computer to the lab and everything you make stays on your computer.",
    },
    {
        q: 'How do templates work?',
        a: 'Pick a template for LinkedIn, Tinder or Instagram and add a few photos of yourself. Umber writes the prompt and picks the settings, and you get photos sized for that platform.',
    },
    {
        q: 'What does it run on?',
        a: 'macOS, Windows and Linux.',
    },
]

const images = countOf('image')
const video = countOf('video')

// What the app does, in the words a search engine indexes.
const FEATURES = [
    `AI image generation with ${images.models} models from ${images.labs} labs`,
    `AI video generation with ${video.models} models from ${video.labs} labs`,
    'Photo templates for LinkedIn headshots, dating profiles and Instagram',
    'Bring your own API keys, with no subscription or markup',
    'The price of every generation shown before it runs',
    'A local gallery that keeps every prompt and setting',
]

const jsonLd = (release: Release | null) => ({
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'WebSite',
            '@id': `${SITE_URL}/#website`,
            url: SITE_URL,
            name: SITE_NAME,
            description: SITE_DESCRIPTION,
            inLanguage: 'en',
            publisher: { '@id': `${SITE_URL}/#author` },
        },
        {
            '@type': 'Person',
            '@id': `${SITE_URL}/#author`,
            name: 'Siebe Baree',
            url: GITHUB_URL,
        },
        {
            '@type': 'SoftwareApplication',
            '@id': `${SITE_URL}/#app`,
            name: SITE_NAME,
            url: SITE_URL,
            description: SITE_DESCRIPTION,
            applicationCategory: 'MultimediaApplication',
            applicationSubCategory: 'AI image and video generator',
            operatingSystem: 'macOS, Windows, Linux',
            image: `${SITE_URL}/opengraph-image`,
            screenshot: `${SITE_URL}/app/create.webp`,
            featureList: FEATURES,
            // Only claimed when a real release backs it up.
            ...(release ? { softwareVersion: release.version } : {}),
            downloadUrl: `${SITE_URL}/download`,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
            isAccessibleForFree: true,
            license: LICENSE_URL,
            sameAs: [GITHUB_URL],
            author: { '@id': `${SITE_URL}/#author` },
        },
        {
            '@type': 'FAQPage',
            '@id': `${SITE_URL}/#faq`,
            mainEntity: FAQ_ITEMS.map((item) => ({
                '@type': 'Question',
                name: item.q,
                acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
        },
    ],
})

export default async function Home() {
    const release = await getLatestRelease()
    const releaseLine = <ReleaseLine release={release} />

    return (
        <div className="flex flex-1 flex-col overflow-x-clip" id="top">
            <script
                // Static JSON-LD built from constants.
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(jsonLd(release)).replaceAll('<', '\\u003c'),
                }}
                type="application/ld+json"
            />
            <ThemeShift />
            <Nav />

            <main className="flex-1">
                <Hero releaseLine={releaseLine} />
                <Develop />
                <Reel />
                <Templates />
                <Pricing />
                <ModelsIndex />

                <section className="relative pt-8 pb-28 sm:pb-40" data-theme="canvas" id="faq">
                    <div className="mx-auto grid max-w-[1400px] gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                        <h2 className="display text-[clamp(3.6rem,7.6vw,8.25rem)]">Questions</h2>
                        <div className="border-t border-hair">
                            {FAQ_ITEMS.map((item) => (
                                <FaqItem a={item.a} key={item.q} q={item.q} />
                            ))}
                        </div>
                    </div>
                </section>

                <Finale releaseLine={releaseLine} />
            </main>

            {/* The app's backdrop, and a solid layer per theme that fades in over
          it (see `theme-layer`). */}
            <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
                <div className="backdrop-glow absolute inset-0">
                    <div className="grain absolute inset-0 opacity-60" />
                </div>
                <div className="theme-layer absolute inset-0 bg-white/40" data-for="mist" />
                <div className="theme-layer absolute inset-0 bg-night" data-for="night" />
                <div className="theme-layer absolute inset-0 bg-accent" data-for="accent" />
            </div>
        </div>
    )
}
