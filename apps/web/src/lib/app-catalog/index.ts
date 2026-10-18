/*
 * The Umber app's model catalog, so the site lists exactly the models the
 * app offers.
 *
 * Everything in this folder except this file is copied unchanged from the
 * app (packages/ui/src/features/create/catalog): types, output-size,
 * price-rules, image-models and video-models. To update, copy those five
 * files over again and run `pnpm format`.
 */
import { IMAGE_MODELS } from "./image-models";
import type { Model } from "./types";
import { VIDEO_MODELS } from "./video-models";

export { IMAGE_MODELS } from "./image-models";
export * from "./types";
export { VIDEO_MODELS } from "./video-models";

export type Mode = "image" | "video";

export const MODELS_BY_MODE: Readonly<Record<Mode, readonly Model[]>> = {
  image: IMAGE_MODELS,
  video: VIDEO_MODELS,
};
