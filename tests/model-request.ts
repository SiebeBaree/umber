import { findModel } from '../packages/ui/src/features/create/catalog'
import type { EngineRequest } from '../packages/ui/src/features/generate/request'

export function modelRequest(
    modelId: string,
    overrides: Partial<EngineRequest> = {},
): EngineRequest {
    const model = findModel('image', modelId) ?? findModel('video', modelId)
    if (model === undefined) throw new Error(`Missing model: ${modelId}`)
    return {
        mode: model.kind,
        providerId: model.provider,
        modelId,
        credentials: { apiKey: 'test-key', workspaceId: 'workspace-123', region: 'international' },
        prompt: 'A lighthouse',
        count: 1,
        quality: 'medium',
        ratio: model.aspectRatios[0],
        resolution: model.resolutions[0],
        durationSeconds: 8,
        references: [],
        ...overrides,
    }
}

export function referenceImage(): File {
    return new File(['reference'], 'reference.png', { type: 'image/png' })
}
