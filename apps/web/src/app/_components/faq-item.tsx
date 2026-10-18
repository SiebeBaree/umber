'use client'

import { useId, useState } from 'react'

/*
 * One FAQ row that opens and closes smoothly. A native <details> snaps: its
 * content height cannot be transitioned everywhere (Safari has no
 * `interpolate-size`), so this eases a grid row between 0fr and 1fr behind
 * the same disclosure semantics (a heading around a button, aria-expanded,
 * region). The answer stays in the DOM either way, so crawlers read the full
 * text.
 */
export function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false)
    const panelId = useId()

    return (
        <div className="border-b border-hair">
            <h3>
                <button
                    aria-controls={panelId}
                    aria-expanded={open}
                    className="flex w-full cursor-pointer items-center justify-between gap-6 py-6 text-left text-xl font-medium tracking-[-0.02em] sm:text-2xl"
                    onClick={() => setOpen((v) => !v)}
                    type="button"
                >
                    {q}
                    <svg
                        aria-hidden="true"
                        className={`size-5 shrink-0 text-accent transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                            open ? 'rotate-45' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 16 16"
                    >
                        <path
                            d="M8 2v12M2 8h12"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="1.5"
                        />
                    </svg>
                </button>
            </h3>
            <div
                className="grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                id={panelId}
                style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
            >
                <div className="overflow-hidden">
                    <p
                        className={`max-w-2xl pb-7 text-pretty text-dim transition-opacity duration-500 sm:text-lg ${
                            open ? 'opacity-100' : 'opacity-0'
                        }`}
                    >
                        {a}
                    </p>
                </div>
            </div>
        </div>
    )
}
