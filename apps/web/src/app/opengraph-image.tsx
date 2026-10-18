import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { ImageResponse } from 'next/og'

import { SLOGAN } from '../lib/site'

export const alt = `Umber. ${SLOGAN}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/*
 * The site's blue canvas with the slogan over a band of example generations
 * across the lower half, smallest at the centre and growing outward until
 * the outer cards crop off the edges. The og renderer cannot decode webp or
 * turn cards in 3D, so the band uses pre-converted jpegs from _og/ and fakes
 * depth with size alone.
 */
const BAND = {
    // Vertical centre of the band.
    y: 474,
    // Seam to edge.
    heights: [72, 108, 168],
    // Like the hero, the gap opens as cards travel outward.
    gaps: [16, 26],
    // Half of the centre gap, where cards all but touch.
    seam: 4,
}

// Seam -> edge, matching BAND.heights.
const CARDS = {
    left: ['frost', 'glass-jellyfish', 'paper-boat'],
    right: ['koi-above', 'ice-arch', 'white-horse'],
}

function cardRects(side: 'left' | 'right') {
    const rects = []
    let cursor = size.width / 2 + BAND.seam
    for (const [i, height] of BAND.heights.entries()) {
        const width = Math.round((height * 16) / 9)
        rects.push({
            left: side === 'right' ? cursor : size.width - cursor - width,
            top: BAND.y - height / 2,
            width,
            height,
        })
        cursor += width + (BAND.gaps[i] ?? 0)
    }
    return rects
}

async function cardUri(name: string) {
    const jpeg = await readFile(join(process.cwd(), `src/app/_og/${name}.jpg`))
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
}

export default async function Image() {
    const lockup = await readFile(join(process.cwd(), 'public/brand/lockup.svg'), 'utf8')

    const band = (['left', 'right'] as const).flatMap((side) =>
        cardRects(side).map((rect, i) => ({ rect, name: CARDS[side][i] })),
    )
    const uris = new Map(
        await Promise.all(
            [...CARDS.left, ...CARDS.right].map(
                async (name) => [name, await cardUri(name)] as const,
            ),
        ),
    )

    return new ImageResponse(
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingTop: 76,
                backgroundColor: '#cbdaf2',
                // The app's backdrop, frozen: soft white light on the blue.
                backgroundImage:
                    'radial-gradient(560px 400px at 10% 6%, rgba(255,255,255,0.85), rgba(255,255,255,0) 70%), radial-gradient(700px 480px at 92% 96%, rgba(255,255,255,0.7), rgba(255,255,255,0) 70%)',
            }}
        >
            {/* Satori renders plain img. */}
            <img
                src={`data:image/svg+xml,${encodeURIComponent(lockup)}`}
                width={440}
                height={126}
                alt=""
            />
            <div
                style={{
                    marginTop: 24,
                    fontSize: 46,
                    color: '#1c2333',
                    letterSpacing: '-0.03em',
                }}
            >
                {SLOGAN}
            </div>
            {band.map(({ rect, name }) => (
                // Satori renders plain img.
                <img
                    key={`${name}-${rect.left}`}
                    src={uris.get(name)}
                    alt=""
                    style={{
                        position: 'absolute',
                        ...rect,
                        borderRadius: 16,
                        objectFit: 'cover',
                        boxShadow: '0 16px 40px -18px rgba(28,41,90,0.35)',
                    }}
                />
            ))}
        </div>,
        size,
    )
}
