/**
 * What every Templates prompt carries besides its scene: who the person is,
 * and what kind of photo this is. Both stay out of the editable text, so an
 * edit to a scene can never drop the part that keeps the face.
 */

/**
 * The identity paragraph, for however many of the user's photos go along.
 *
 * The references are for who the person is and nothing else. People upload
 * selfies, filtered and portrait-mode shots, and a model told to keep the skin
 * "as it is" copies that smoothing and lens distortion straight into the scene,
 * or pastes the face in sharper than everything around it.
 */
export function identityRules(photos: number): string {
    const which =
        photos === 1 ? 'Image 1 is a reference photo' : `Images 1 to ${photos} are reference photos`

    return `${which} of the person in this photo. Use them only to know what they look like: face, skin, hairline, teeth and build. Ignore the lens, filters, smoothing and light in them, since some may be selfies or edited. Render the person fresh in this scene's light and camera, so their face is no sharper or cleaner than everything around it. Keep real skin with pores, small marks and uneven tone, and no makeup beyond what they wear in their photos. Do not make them more attractive, younger or slimmer.`
}

export const REALISM_RULES =
    'An ordinary phone photo. Everything in focus, with some noise in the shadows. No retouching, no colour grade, no background blur and no studio light.'

/** The full prompt one photo is rendered from. */
export function composePrompt(scene: string, photos: number): string {
    return [identityRules(photos), scene.trim(), REALISM_RULES].join('\n\n')
}
