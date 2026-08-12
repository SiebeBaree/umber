/**
 * The living canvas behind every page: a cool blue field with soft white blobs
 * drifting across it, and film grain laid over the top.
 *
 * Layering is expressed by document order inside one fixed, non-interactive
 * container — wash, then blobs, then grain — rather than by z-indexes scattered
 * across the stylesheet, so what sits in front of what is readable here.
 *
 * The blobs are blurred far past their own edges, which is what turns three
 * circles into weather; the blur is static, so only cheap transforms animate.
 */
export function CanvasBackdrop() {
    return (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
            {/*
             * Sized and spaced so the blue always reads between them: blobs
             * much wider than this would merge into a single white field and
             * the canvas would lose its colour entirely.
             */}
            <div className="drift-a absolute -top-[14%] -left-[6%] size-[30rem] rounded-full bg-white/85 blur-[90px]" />
            <div className="drift-b absolute -right-[8%] -bottom-[16%] size-[34rem] rounded-full bg-white/70 blur-[100px]" />
            <div className="drift-c absolute top-[34%] left-[42%] size-[24rem] rounded-full bg-white/55 blur-[80px]" />

            <div className="film-grain absolute inset-0 opacity-70" />
        </div>
    )
}
