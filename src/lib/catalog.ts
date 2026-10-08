import { IMAGE_MODELS, type ProviderId, VIDEO_MODELS } from "./app-catalog";

/*
 * The labs and models the site lists, derived from the app's own catalog
 * (see ./app-catalog), so counts and lists always match what the app offers.
 * Lab names and their order on the page live here.
 */

export const LABS = {
  google: "Google",
  openai: "OpenAI",
  blackForestLabs: "Black Forest Labs",
  bytedance: "ByteDance",
  kuaishou: "Kling",
  alibaba: "Alibaba",
  runway: "Runway",
  ideogram: "Ideogram",
  recraft: "Recraft",
  xai: "xAI",
  reve: "Reve",
  minimax: "MiniMax",
} as const satisfies Record<ProviderId, string>;

export type LabId = ProviderId;

export const LAB_IDS = Object.keys(LABS) as LabId[];

export const MODELS = [...IMAGE_MODELS, ...VIDEO_MODELS].map((model) => ({
  name: model.name,
  lab: model.provider,
  kind: model.kind,
}));

export type ModelName = string;

/** How many models, and from how many labs, the app offers of one kind. */
export function countOf(kind: "image" | "video") {
  const models = MODELS.filter((m) => m.kind === kind);
  return {
    models: models.length,
    labs: new Set(models.map((m) => m.lab)).size,
  };
}
