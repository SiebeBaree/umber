"use client";

import { useRef } from "react";
import { Logo } from "./logo";
import { clamp01, setStyle, useScrollFrame } from "./scroll";

/*
 * What Umber costs, as a receipt that prints itself while it scrolls into
 * view: the paper rises out of a slot. Prices are the labs' own, from the
 * app's catalog.
 */

const ZERO_LINES = ["App", "Account", "Subscription", "Credits", "Markup"];

const CHARGES = [
  {
    model: "GPT Image 2.5 Flare",
    detail: "1 image, 2K, high",
    lab: "OpenAI",
    price: "$0.06",
  },
  {
    model: "Veo 3.1",
    detail: "1 clip, 4s, 720p",
    lab: "Google",
    price: "$1.60",
  },
];

const FACTS = [
  {
    title: "Your keys stay on your machine",
    body: "Encrypted by your operating system's keychain and sent only to the lab they belong to.",
  },
  {
    title: "So does your work",
    body: "Images and videos are saved on your computer, never on a server.",
  },
  {
    title: "Open source",
    body: "MIT licensed. Read the code, fork it, build on it.",
  },
];

// A fixed, made-up barcode: bar widths in px, alternating ink and gap.
const BARCODE = [
  2, 1, 1, 2, 3, 1, 1, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1, 1, 1, 2, 1, 1, 3, 1,
  2, 2, 1, 1, 2, 3, 1, 2, 1, 1, 1, 3, 2, 1, 1, 2, 1, 1, 2, 2, 3, 1, 1, 2,
];

export function Pricing() {
  const receiptRef = useRef<HTMLDivElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  useScrollFrame(
    receiptRef,
    (p) => {
      const printed = clamp01((p - 0.1) / 0.36);
      setStyle(
        paperRef.current,
        "transform",
        `translateY(${((1 - printed) * 100).toFixed(2)}%)`,
      );
    },
    "pass",
  );

  return (
    <section
      className="relative py-28 sm:py-40"
      data-theme="canvas"
      id="pricing"
    >
      <div className="mx-auto grid max-w-[1400px] items-center gap-16 px-5 sm:px-8 lg:grid-cols-2">
        <div>
          <h2 className="display text-[clamp(3.6rem,7.6vw,8.25rem)]">
            Pricing
          </h2>
          <p className="mt-8 max-w-md text-pretty text-dim sm:text-lg">
            Umber is free. Each lab bills you for what you make, at their own
            price, and Umber never sees the key, the bill or the pictures.
          </p>
          <dl className="mt-12 grid max-w-lg gap-6">
            {FACTS.map((fact) => (
              <div className="border-t border-hair pt-5" key={fact.title}>
                <dt className="font-medium">{fact.title}</dt>
                <dd className="mt-1 text-sm text-dim">{fact.body}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mx-auto w-[min(88vw,370px)]" ref={receiptRef}>
          {/* Paper rises out of the slot below it, header first. */}
          <div className="-mb-2 overflow-hidden px-3">
            <div
              className="receipt bg-surface px-6 pt-9 pb-10 font-mono text-[12.5px] leading-relaxed text-ink shadow-[0_16px_40px_-20px_rgb(28_41_90/0.3)] will-change-transform"
              ref={paperRef}
              style={{ transform: "translateY(100%)" }}
            >
              <Logo className="mx-auto h-7 w-auto" id="receipt" />
              <p className="mt-2 text-center text-ink/60">
                Open source AI studio
              </p>
              <Rule />
              <p className="text-ink/60">ORDER #000001</p>
              <Rule />
              {ZERO_LINES.map((line) => (
                <Row amount="$0.00" key={line} label={line} />
              ))}
              <Rule />
              {CHARGES.map((charge) => (
                <div className="mb-3" key={charge.model}>
                  <p>{charge.model}</p>
                  <Row amount={charge.price} label={charge.detail} muted />
                  <p className="text-ink/60">Billed by {charge.lab}</p>
                </div>
              ))}
              <Rule double />
              <Row amount="$0.00" label="PAID TO UMBER" strong />
              <Rule double />
              <p className="mt-5 text-center">Thanks for not subscribing.</p>
              <div
                aria-hidden="true"
                className="mx-auto mt-5 flex h-12 w-fit items-stretch"
              >
                {BARCODE.map((width, i) => (
                  <span
                    className={i % 2 ? "" : "bg-ink"}
                    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed pattern
                    key={i}
                    style={{ width }}
                  />
                ))}
              </div>
            </div>
          </div>
          {/* The printer's slot. */}
          <div className="glass-raised relative z-10 h-4 rounded-full" />
        </div>
      </div>
    </section>
  );
}

function Row({
  label,
  amount,
  muted = false,
  strong = false,
}: {
  label: string;
  amount: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <p
      className={`flex justify-between gap-4 ${muted ? "pl-3 text-ink/70" : ""} ${
        strong ? "font-semibold" : ""
      }`}
    >
      <span>{label}</span>
      <span className="text-ink">{amount}</span>
    </p>
  );
}

function Rule({ double = false }: { double?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`my-3 border-ink/40 ${
        double ? "h-1 border-y" : "border-t border-dashed"
      }`}
    />
  );
}
