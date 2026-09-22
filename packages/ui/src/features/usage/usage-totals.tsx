import { formatCost } from '../create/pricing'
import type { UsageSummary } from './usage-summary'

function duration(ms: number | null) {
    return ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`
}
export function UsageTotals({ summary }: { readonly summary: UsageSummary }) {
    return (
        <dl className="my-10 grid grid-cols-3 gap-4">
            <div>
                <dt className="text-xs text-muted">Estimated cost</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">
                    {summary.count > 0 && summary.unknown === summary.count
                        ? '—'
                        : `${formatCost(summary.cost)}${summary.unknown > 0 ? '+' : ''}`}
                </dd>
            </div>
            <div>
                <dt className="text-xs text-muted">Creations</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">{summary.count}</dd>
            </div>
            <div>
                <dt className="text-xs text-muted">Average render</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums">
                    {duration(summary.averageMs)}
                </dd>
            </div>
        </dl>
    )
}
export function UsageModels({ summary }: { readonly summary: UsageSummary }) {
    if (summary.count === 0)
        return <p className="mt-8 text-sm text-muted">No creations in this period.</p>
    return (
        <div className="mt-10 overflow-x-auto">
            <table className="w-full text-left text-sm">
                <caption className="sr-only">Usage by model</caption>
                <thead className="text-xs text-muted">
                    <tr>
                        <th className="pb-3 font-normal">Model</th>
                        <th className="pb-3 text-right font-normal">Creations</th>
                        <th className="pb-3 text-right font-normal">Avg. render</th>
                        <th className="pb-3 text-right font-normal">Est. cost</th>
                    </tr>
                </thead>
                <tbody>
                    {summary.models.map(([id, model]) => (
                        <tr className="border-t border-ink/[0.06]" key={id}>
                            <th className="py-4 font-medium">{model.name}</th>
                            <td className="text-right tabular-nums">{model.count}</td>
                            <td className="text-right tabular-nums">
                                {duration(model.timed === 0 ? null : model.totalMs / model.timed)}
                            </td>
                            <td className="text-right tabular-nums">
                                {model.unknown === model.count
                                    ? '—'
                                    : `${formatCost(model.cost)}${model.unknown > 0 ? '+' : ''}`}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
