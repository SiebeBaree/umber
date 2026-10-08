import { LAB_IDS, LABS, MODELS } from "../../lib/catalog";
import { ProviderMark } from "./provider-mark";

/*
 * Every lab and model in the app, one lab per row. Hovering a row wipes it
 * in the accent blue (the `wipe` utility).
 */
export function ModelsIndex() {
  return (
    <section
      className="relative py-28 sm:py-40"
      data-theme="canvas"
      id="models"
    >
      <div className="mx-auto max-w-[1400px] px-5 sm:px-8">
        <h2 className="display text-[clamp(3.6rem,7.6vw,8.25rem)]">Models</h2>
        <p className="mt-8 max-w-md text-pretty text-dim sm:text-lg">
          Paste an API key from any of these labs and its models show up in the
          picker.
        </p>
      </div>

      <ul className="mt-16 border-t border-hair sm:mt-20">
        {LAB_IDS.map((lab) => {
          const models = MODELS.filter((m) => m.lab === lab);
          const kinds = (["image", "video"] as const)
            .map(
              (kind) =>
                [kind, models.filter((m) => m.kind === kind).length] as const,
            )
            .filter(([, count]) => count > 0)
            .map(([kind, count]) => `${count} ${kind}`);
          return (
            <li className="wipe border-b border-hair" key={lab}>
              <div className="mx-auto grid max-w-[1400px] grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-5 gap-y-1.5 px-5 py-5 sm:px-8 lg:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1.25fr)_9rem] lg:gap-x-8 lg:py-6">
                <ProviderMark className="size-6 lg:size-8" provider={lab} />
                <span className="text-3xl leading-none font-semibold tracking-[-0.025em] lg:text-5xl">
                  {LABS[lab]}
                </span>
                <span className="col-start-2 text-[13px] leading-relaxed text-dim lg:col-start-auto">
                  {models.map((m) => m.name).join(", ")}
                </span>
                <span className="text-[13px] whitespace-nowrap text-dim tabular-nums max-lg:hidden lg:text-right">
                  {kinds.join(" · ")}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
