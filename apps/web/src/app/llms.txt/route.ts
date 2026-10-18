import { countOf, MODELS } from '../../lib/catalog'
import {
    GITHUB_URL,
    LICENSE_URL,
    listOf,
    PROVIDERS,
    SITE_DESCRIPTION,
    SITE_URL,
} from '../../lib/site'

/*
 * llms.txt (llmstxt.org): a plain-markdown summary served for AI crawlers
 * and assistants, so answers about Umber come from these facts instead of
 * guesses. Built from the same constants as the rest of the site.
 */
const image = countOf('image')
const video = countOf('video')

const BODY = `# Umber

> ${SITE_DESCRIPTION}

Umber is a desktop app for AI image and video generation. There is no Umber
server and no Umber account: you connect your own API keys and the app talks
to each AI lab directly.

Key facts:

- Price: free. Open source under the MIT license. The only money spent goes
  to the AI labs, at their own price per generation. Umber adds no markup.
- Models: ${MODELS.length} in total, ${image.models} for images and
  ${video.models} for video, from ${listOf(PROVIDERS)}. One API key is enough
  to start.
- Templates: ready-made templates for LinkedIn headshots, dating profile
  photos and Instagram posts. Add a few photos of yourself and pick one.
- Cost preview: the price of every generation is shown before it runs.
- Privacy: API keys are encrypted with the operating system's keychain and
  sent only to the lab they belong to. Prompts go straight from your computer
  to the lab. Every image and video is saved on your computer with the
  prompt, model and settings behind it.
- Platforms: macOS, Windows and Linux.

## Links

- [Website](${SITE_URL}): overview, model list and download
- [Download](${SITE_URL}/download): redirects to the newest installer for the
  visitor's platform. Add \`?os=mac\`, \`?os=windows\` or \`?os=linux\` to pick one.
- [GitHub repository](${GITHUB_URL}): source code, issues and releases
- [MIT License](${LICENSE_URL})

## FAQ

- Is Umber really free? Yes. MIT licensed, no markup, no cut. You only pay
  the labs for what you generate.
- Can Umber see my keys, prompts or images? No. Keys live in your OS
  keychain, requests go straight to the lab and your work stays on your
  computer.
- Do I need a key for every lab? No, one is enough. The model picker shows
  what each key unlocks.
`

export const dynamic = 'force-static'

export function GET() {
    return new Response(BODY, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
}
