import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'

import { UsageChart } from '../packages/ui/src/features/usage/usage-chart'
import { summarizeUsage } from '../packages/ui/src/features/usage/usage-summary'
import { UsageTotals } from '../packages/ui/src/features/usage/usage-totals'

const now = new Date(2026, 8, 22, 12).getTime()

test.each([
    { costs: [null], total: '—', label: 'cost not recorded' },
    { costs: [null, 0.1], total: '$0.10+', label: '$0.10 estimated, 1 without recorded cost' },
    { costs: [0], total: '$0.00', label: '$0.00 estimated' },
    { costs: [], total: '$0.00', label: '$0.00 estimated' },
])('usage distinguishes costs $costs from a free or empty period', ({ costs, total, label }) => {
    const records = costs.map((estimatedCost, index) => ({
        id: String(index),
        modelId: 'test',
        modelName: 'Test model',
        createdAt: now,
        estimatedCost,
    }))
    const summary = summarizeUsage(records, '7', now)
    const totals = document.createElement('div')
    totals.innerHTML = renderToStaticMarkup(<UsageTotals summary={summary} />)
    expect(totals.querySelector('dd')?.textContent).toBe(total)
    const chart = document.createElement('div')
    chart.innerHTML = renderToStaticMarkup(<UsageChart buckets={summary.buckets} period="7" />)
    const bars = [...chart.querySelectorAll('fieldset button')]
    expect(bars.at(-1)?.getAttribute('aria-label')).toContain(label)
})
