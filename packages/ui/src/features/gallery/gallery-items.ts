import type { AspectRatio } from '../create/catalog'

/**
 * One creation in the gallery.
 *
 * Placeholder shape until generations are read from disk: the gradient stands
 * in for the rendered file, and the prompt doubles as the image's accessible
 * name — it is the only description of the picture that exists.
 */
export interface GalleryItem {
    readonly id: string
    readonly prompt: string
    readonly ratio: AspectRatio
    /** CSS background layers painted where the image file will eventually go. */
    readonly gradient: string
}

/**
 * Hard-coded stand-ins, newest first, covering every aspect ratio the catalog
 * offers so the masonry is exercised by all the shapes it will ever meet.
 *
 * Each gradient is two layers — a soft radial light source over a linear wash —
 * because a single linear gradient reads as a swatch, and these need to read as
 * pictures.
 */
export const GALLERY_ITEMS: readonly GalleryItem[] = [
    {
        id: 'golden-tea-fields',
        prompt: 'Golden hour light washing over terraced tea fields',
        ratio: '3:2',
        gradient:
            'radial-gradient(120% 100% at 85% 10%, rgb(255 218 160 / 0.9), transparent 55%), linear-gradient(140deg, #f2b866 0%, #dd7a58 55%, #94485c 100%)',
    },
    {
        id: 'neon-alley',
        prompt: 'Rain-slicked alley lit by neon signs, cinematic',
        ratio: '9:16',
        gradient:
            'radial-gradient(90% 55% at 22% 12%, rgb(255 96 214 / 0.5), transparent 60%), linear-gradient(200deg, #33125f 0%, #4a1d96 45%, #100c2a 100%)',
    },
    {
        id: 'porcelain-still-life',
        prompt: 'Minimal still life of porcelain vases in soft daylight',
        ratio: '1:1',
        gradient:
            'radial-gradient(100% 80% at 30% 18%, rgb(253 246 236 / 0.95), transparent 70%), linear-gradient(160deg, #efe3d3 0%, #c9b6a4 100%)',
    },
    {
        id: 'alpine-lake',
        prompt: 'Mirror-calm alpine lake at first light',
        ratio: '4:3',
        gradient:
            'radial-gradient(80% 50% at 50% 32%, rgb(255 236 210 / 0.6), transparent 62%), linear-gradient(180deg, #a5c6ec 0%, #7ba4d6 48%, #395f8f 100%)',
    },
    {
        id: 'saffron-market',
        prompt: 'Overhead shot of saffron and spice bowls on linen',
        ratio: '2:3',
        gradient:
            'radial-gradient(95% 60% at 70% 20%, rgb(255 196 112 / 0.75), transparent 60%), linear-gradient(215deg, #e9973f 0%, #c85c2e 55%, #7e2f24 100%)',
    },
    {
        id: 'glass-city',
        prompt: 'Futuristic glass skyline at dusk, reflections everywhere',
        ratio: '16:9',
        gradient:
            'radial-gradient(70% 90% at 78% 25%, rgb(122 231 255 / 0.55), transparent 60%), linear-gradient(205deg, #1e3a6d 0%, #35519c 50%, #52306e 100%)',
    },
    {
        id: 'fern-macro',
        prompt: 'Macro of dew beading on a curled fern frond',
        ratio: '3:4',
        gradient:
            'radial-gradient(90% 60% at 25% 22%, rgb(214 255 199 / 0.7), transparent 60%), linear-gradient(170deg, #7cb56b 0%, #3f7a4a 55%, #1f4531 100%)',
    },
    {
        id: 'desert-ridge',
        prompt: 'Ultrawide desert ridge under a pale morning sky',
        ratio: '21:9',
        gradient:
            'radial-gradient(60% 90% at 50% 0%, rgb(236 244 255 / 0.8), transparent 65%), linear-gradient(180deg, #d9e2ec 0%, #e8c9a0 55%, #c08a56 100%)',
    },
    {
        id: 'koi-pond',
        prompt: 'Koi drifting beneath lily pads, watercolour style',
        ratio: '1:1',
        gradient:
            'radial-gradient(70% 70% at 68% 65%, rgb(255 155 94 / 0.55), transparent 55%), linear-gradient(150deg, #8fd0c9 0%, #4d9d9c 60%, #2d6a72 100%)',
    },
    {
        id: 'lighthouse-storm',
        prompt: 'Lighthouse braced against a rolling storm swell',
        ratio: '2:3',
        gradient:
            'radial-gradient(85% 45% at 35% 12%, rgb(255 244 214 / 0.65), transparent 58%), linear-gradient(195deg, #5a708c 0%, #3c4f6c 50%, #1d2940 100%)',
    },
    {
        id: 'citrus-splash',
        prompt: 'High-speed splash of citrus slices in sparkling water',
        ratio: '3:2',
        gradient:
            'radial-gradient(95% 75% at 30% 25%, rgb(255 250 176 / 0.85), transparent 60%), linear-gradient(135deg, #f4d444 0%, #a8ca3e 55%, #4c9a51 100%)',
    },
    {
        id: 'paper-cranes',
        prompt: 'Paper cranes suspended in a beam of morning light',
        ratio: '9:16',
        gradient:
            'radial-gradient(100% 55% at 55% 15%, rgb(255 240 246 / 0.85), transparent 62%), linear-gradient(190deg, #f4d9e4 0%, #cdb6dc 55%, #8f8ac4 100%)',
    },
    {
        id: 'midnight-train',
        prompt: 'A midnight train crossing a viaduct, long exposure',
        ratio: '16:9',
        gradient:
            'radial-gradient(55% 80% at 20% 70%, rgb(255 179 102 / 0.5), transparent 55%), linear-gradient(210deg, #1b2a4a 0%, #14203a 55%, #0a1122 100%)',
    },
    {
        id: 'clay-portrait',
        prompt: 'Sculpted clay portrait in warm studio light',
        ratio: '3:4',
        gradient:
            'radial-gradient(85% 60% at 68% 25%, rgb(255 214 186 / 0.8), transparent 60%), linear-gradient(160deg, #d9a184 0%, #b0654a 60%, #6f3a2e 100%)',
    },
    {
        id: 'tidal-swirl',
        prompt: 'Aerial view of turquoise tide swirling over pale sand',
        ratio: '1:1',
        gradient:
            'radial-gradient(90% 90% at 75% 80%, rgb(250 236 209 / 0.85), transparent 55%), linear-gradient(140deg, #2fa8b8 0%, #63c6c4 55%, #b8e3d2 100%)',
    },
    {
        id: 'library-dust',
        prompt: 'Sunbeams through the stacks of a quiet old library',
        ratio: '4:3',
        gradient:
            'radial-gradient(60% 85% at 62% 18%, rgb(255 226 168 / 0.85), transparent 58%), linear-gradient(200deg, #a97e4f 0%, #7a5432 55%, #43301e 100%)',
    },
    {
        id: 'orchid-noir',
        prompt: 'Single orchid on black velvet, dramatic side light',
        ratio: '2:3',
        gradient:
            'radial-gradient(70% 50% at 60% 35%, rgb(216 132 255 / 0.55), transparent 58%), linear-gradient(180deg, #2a1a38 0%, #1a1026 55%, #0b0712 100%)',
    },
    {
        id: 'northern-coast',
        prompt: 'Panorama of a windswept northern coastline',
        ratio: '21:9',
        gradient:
            'radial-gradient(50% 80% at 30% 10%, rgb(232 244 246 / 0.8), transparent 60%), linear-gradient(185deg, #a9c2c8 0%, #6e93a2 55%, #40606f 100%)',
    },
    {
        id: 'wildflower-field',
        prompt: 'Wildflower meadow leaning in a summer wind',
        ratio: '3:2',
        gradient:
            'radial-gradient(85% 60% at 70% 15%, rgb(255 241 214 / 0.8), transparent 60%), linear-gradient(165deg, #9fcb7a 0%, #6da85f 50%, #d98aa6 115%)',
    },
    {
        id: 'jellyfish-drift',
        prompt: 'Bioluminescent jellyfish drifting toward the surface',
        ratio: '9:16',
        gradient:
            'radial-gradient(80% 45% at 50% 30%, rgb(126 233 255 / 0.6), transparent 58%), linear-gradient(190deg, #123a5c 0%, #0d2a4a 55%, #051225 100%)',
    },
    {
        id: 'autumn-canal',
        prompt: 'Autumn canal reflections on a still Amsterdam morning',
        ratio: '4:3',
        gradient:
            'radial-gradient(75% 55% at 40% 20%, rgb(255 214 156 / 0.75), transparent 58%), linear-gradient(175deg, #d98f4d 0%, #a05f3a 55%, #37545c 100%)',
    },
    {
        id: 'marble-arch',
        prompt: 'Weathered marble archway caught in raking light',
        ratio: '3:4',
        gradient:
            'radial-gradient(90% 55% at 30% 18%, rgb(252 248 240 / 0.9), transparent 62%), linear-gradient(170deg, #ded8cd 0%, #b6ada2 55%, #7e766d 100%)',
    },
    {
        id: 'lavender-dusk',
        prompt: 'Lavender rows fading into a hazy dusk',
        ratio: '16:9',
        gradient:
            'radial-gradient(70% 60% at 75% 20%, rgb(255 205 225 / 0.65), transparent 58%), linear-gradient(190deg, #b99ed6 0%, #8a74b8 55%, #4e4478 100%)',
    },
    {
        id: 'dune-caravan',
        prompt: 'Caravan shadows stretching long across rolling dunes',
        ratio: '21:9',
        gradient:
            'radial-gradient(55% 90% at 72% 15%, rgb(255 233 188 / 0.85), transparent 58%), linear-gradient(180deg, #efc98d 0%, #d99f5b 55%, #9c6534 100%)',
    },
]
