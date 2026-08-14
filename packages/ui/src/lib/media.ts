/**
 * What a saved file should be called on disk.
 *
 * Providers do not all hand back the same format, and several return JPEG
 * where the obvious guess would be PNG, so the extension comes from the
 * stored blob's own type rather than from the kind of run that made it.
 */
const EXTENSIONS: Readonly<Record<string, string>> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
}

export function mediaExtension(mediaType: string | undefined, kind: 'image' | 'video'): string {
    // Blob types can carry parameters, as in `image/jpeg; charset=binary`.
    const bare = (mediaType ?? '').split(';')[0]?.trim().toLowerCase() ?? ''

    return EXTENSIONS[bare] ?? (kind === 'video' ? 'mp4' : 'png')
}
