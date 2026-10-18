import {
  IMAGE_MODELS,
  type Model,
  priceAt,
  VIDEO_MODELS,
} from "../../lib/app-catalog";
import { PricingEstimate } from "./pricing-estimate";

/*
 * What a month of Umber costs next to the credit subscriptions. The labs'
 * prices come from the app's catalog here, on the server, so the catalog
 * never ships to the browser; the estimate itself is interactive.
 */

/** A catalog model by id. Fails the build if the app ever drops it. */
function find<T extends Model>(models: readonly T[], id: string): T {
  const model = models.find((m) => m.id === id);
  if (!model) {
    throw new Error(`Pricing needs ${id}, which the catalog no longer has`);
  }
  return model;
}

const image = find(IMAGE_MODELS, "gpt-image-2.5-flare");
const video = find(VIDEO_MODELS, "veo-3-1");
const imageRate = image.quality?.pricePerImage.high;
if (!imageRate || !video.pricePerSecond) {
  throw new Error("Pricing needs a fixed price for both models");
}

/** One square image at 2K and high quality. */
const IMAGE_PRICE = priceAt(
  imageRate,
  { resolution: "2K", ratio: "1:1", quality: "high", references: 0 },
  image.resolutions[0],
);

/** One 8 second clip at 1080p. */
const VIDEO_PRICE =
  8 *
  priceAt(
    video.pricePerSecond,
    { resolution: "1080p", ratio: "16:9", quality: "", references: 0 },
    video.resolutions[0],
  );

export function Pricing() {
  return (
    <section
      className="relative py-28 sm:py-40"
      data-theme="canvas"
      id="pricing"
    >
      <PricingEstimate imagePrice={IMAGE_PRICE} videoPrice={VIDEO_PRICE}>
        <h2 className="display text-[clamp(3.6rem,7.6vw,8.25rem)]">Pricing</h2>
        <p className="mt-8 max-w-md text-pretty text-dim sm:text-lg">
          Umber is free. You pay the labs for what you make, at their prices.
        </p>
      </PricingEstimate>
      <div className="mx-auto mt-8 max-w-[1400px] px-5 sm:px-8">
        <p className="max-w-3xl text-[13px] text-dim">
          Estimates for one month on monthly billing, October 2026. Images are
          GPT Image 2.5, square, at 2K and high quality. Videos are 8 second Veo
          3.1 clips at 1080p. Krea only prices Veo 3.1 at 720p without sound, so
          its figure uses that.
        </p>
      </div>
    </section>
  );
}
