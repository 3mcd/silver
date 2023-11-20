import {defineConfig} from "vite"
import wasm from "vite-plugin-wasm"
import react from "@vitejs/plugin-react"
import topLevelAwait from "vite-plugin-top-level-await"

export default defineConfig({
  plugins: [
    react({
      include: [/\.(mdx|js|jsx|ts|tsx)$/],
    }),
    wasm(),
    topLevelAwait(),
  ],
  optimizeDeps: {
    esbuildOptions: {
      target: "esnext",
    },
  },
  build: {
    target: "esnext",
  },
})
