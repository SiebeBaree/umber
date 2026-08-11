import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    server: {
        // Pinned so `pnpm dev` (which starts both apps) is deterministic.
        // @umber/desktop's renderer owns 5174.
        port: 5173,
        strictPort: true,
    },
})
