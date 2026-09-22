import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'

import { TooltipProvider } from '../packages/ui/src/components/ui/tooltip'
import { AspectRatioSelect } from '../packages/ui/src/features/create/controls/aspect-ratio-select'

const ratios = ['1:1'] as const

test.each([true, false])(
    'single-ratio selector respects first-image availability: %s',
    (allowFirst) => {
        const change = vi.fn()
        const container = document.createElement('div')
        container.innerHTML = renderToStaticMarkup(
            <TooltipProvider>
                <AspectRatioSelect
                    allowFirst={allowFirst}
                    options={ratios}
                    value="1:1"
                    modelName="Test model"
                    onValueChange={change}
                />
            </TooltipProvider>,
        )
        const button = container.querySelector('button')
        expect(button?.disabled).toBe(!allowFirst)
        expect(button?.getAttribute('aria-haspopup')).toBe(allowFirst ? 'menu' : null)
    },
)
