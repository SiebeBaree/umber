import { getImageProps, type StaticImageData } from "next/image";
import arcticFox from "../_media/arctic-fox.webp";
import cloudSea from "../_media/cloud-sea.webp";
import dewPetal from "../_media/dew-petal.webp";
import foggyPier from "../_media/foggy-pier.webp";
import glassSphere from "../_media/glass-sphere.webp";
import greenhouse from "../_media/greenhouse.webp";
import horizon from "../_media/horizon.webp";
import iceCave from "../_media/ice-cave.webp";
import koiAbove from "../_media/koi-above.webp";
import koiClouds from "../_media/koi-clouds.webp";
import moonAstronaut from "../_media/moon-astronaut.webp";
import nightDesert from "../_media/night-desert.webp";
import origamiCrane from "../_media/origami-crane.webp";
import rainWindow from "../_media/rain-window.webp";
import redUmbrella from "../_media/red-umbrella.webp";
import sailboat from "../_media/sailboat.webp";
import selfie1 from "../_media/selfie-1.webp";
import selfie2 from "../_media/selfie-2.webp";
import snowForest from "../_media/snow-forest.webp";
import tplDating from "../_media/tpl-dating.webp";
import tplInstagram from "../_media/tpl-instagram.webp";
import tplLinkedin from "../_media/tpl-linkedin.webp";
import whaleTail from "../_media/whale-tail.webp";
import whiteStairs from "../_media/white-stairs.webp";
import whiteTulips from "../_media/white-tulips.webp";

/*
 * Every image on the site, generated with Umber itself (GPT Image 2.5 Flare
 * and Sunburst, and Nano Banana Pro for the template photos). Imported
 * statically so next/image knows their size, serves them resized and has a
 * blurred preview ready for each.
 */
export const media = {
  arcticFox,
  cloudSea,
  dewPetal,
  foggyPier,
  glassSphere,
  greenhouse,
  horizon,
  iceCave,
  koiAbove,
  koiClouds,
  moonAstronaut,
  nightDesert,
  origamiCrane,
  rainWindow,
  redUmbrella,
  sailboat,
  selfie1,
  selfie2,
  snowForest,
  tplDating,
  tplInstagram,
  tplLinkedin,
  whaleTail,
  whiteStairs,
  whiteTulips,
} satisfies Record<string, StaticImageData>;

/**
 * An optimised URL for `image` at least `minWidth` pixels wide, for surfaces
 * that paint images themselves (the develop canvas) instead of through <img>.
 */
export function optimizedSrc(image: StaticImageData, minWidth: number) {
  const { props } = getImageProps({ src: image, alt: "", sizes: "100vw" });
  const candidates = (props.srcSet ?? "").split(", ").map((entry) => {
    const [url, width] = entry.split(" ");
    return { url, width: Number.parseInt(width, 10) };
  });
  return (
    candidates.find((c) => c.width >= minWidth)?.url ??
    candidates.at(-1)?.url ??
    props.src
  );
}
