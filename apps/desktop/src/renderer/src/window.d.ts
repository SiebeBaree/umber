import type { UmberBridge } from '../../shared/bridge'

declare global {
    interface Window {
        /**
         * Injected by the preload script. Optional because the renderer must still
         * work if the preload script failed to run.
         */
        readonly umber?: UmberBridge
    }
}
