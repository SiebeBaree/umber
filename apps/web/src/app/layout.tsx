import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque } from 'next/font/google'

import { GITHUB_URL, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '../lib/site'

import './globals.css'

// One family for everything, self-hosted by next/font. Its optical size axis
// follows the font size, so headings get the sharper display cut and body
// text the calmer one.
const bricolage = Bricolage_Grotesque({
    subsets: ['latin'],
    axes: ['opsz'],
    variable: '--font-bricolage',
})

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    applicationName: SITE_NAME,
    keywords: [
        'AI image generator',
        'AI video generator',
        'open source AI image generator',
        'free AI image generator',
        'AI image generator with your own API key',
        'bring your own API key',
        'text to image',
        'text to video',
        'AI studio desktop app',
        'no subscription AI',
        'AI headshot generator',
        'AI dating profile photos',
    ],
    authors: [{ name: 'Siebe Baree', url: GITHUB_URL }],
    creator: 'Siebe Baree',
    category: 'technology',
    alternates: { canonical: '/' },
    openGraph: {
        type: 'website',
        url: '/',
        siteName: SITE_NAME,
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        locale: 'en_US',
    },
    twitter: {
        card: 'summary_large_image',
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
        },
    },
}

export const viewport: Viewport = {
    themeColor: '#cbdaf2',
}

/*
 * Marks every `.reveal` image as loaded the moment its file arrives (see
 * the `reveal` utility). It runs from <head>, before anything else, so images
 * fade in as they land instead of waiting for React to hydrate. Load events
 * do not bubble and never reach window, hence capturing on document.
 */
const REVEAL_ON_LOAD = `document.addEventListener("load",function(e){var t=e.target;if(t.classList&&t.classList.contains("reveal"))t.setAttribute("data-loaded","")},true)`

export default function RootLayout({ children }: LayoutProps<'/'>) {
    return (
        <html className={`h-full antialiased ${bricolage.variable}`} lang="en">
            <head>
                <script
                    // A fixed inline snippet, no input.
                    dangerouslySetInnerHTML={{ __html: REVEAL_ON_LOAD }}
                />
            </head>
            <body className="min-h-full flex flex-col">{children}</body>
        </html>
    )
}
