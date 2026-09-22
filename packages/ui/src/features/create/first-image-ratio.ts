import { ratioParts, type AspectRatio, type ImageModel } from './catalog'

/** Fixed-shape APIs must never silently substitute a crop for the uploaded shape. */
export function matchImageRatio(width: number, height: number, model: ImageModel): AspectRatio {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error('Could not read the first image dimensions.')
    }
    const ratio = width / height
    const fixed = model.aspectRatios.find((option) => {
        const parts = ratioParts(option)
        return Math.abs(Math.log(ratio / (parts.width / parts.height))) < 0.005
    })
    if (fixed !== undefined) return fixed
    const flexible = model.id.startsWith('gpt-image-2') || model.id.startsWith('flux-2-')
    if (flexible && ratio >= 1 / 3 && ratio <= 3) return `${width}:${height}`
    throw new Error(
        `Umber cannot preserve this image's ${width}:${height} shape with ${model.name}. Choose one of its listed aspect ratios.`,
    )
}

export async function firstImageRatio(
    file: File | undefined,
    model: ImageModel,
): Promise<AspectRatio> {
    if (file === undefined) throw new Error('Upload a reference image to use First image.')
    const bitmap = await createImageBitmap(file).catch(() => {
        throw new Error('Could not read the first image. Try a PNG, JPEG or WebP file.')
    })
    try {
        return matchImageRatio(bitmap.width, bitmap.height, model)
    } finally {
        bitmap.close()
    }
}
