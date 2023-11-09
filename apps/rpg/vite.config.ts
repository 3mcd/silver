import {defineConfig} from "vite"

export default defineConfig({
  build: {
    target: "esnext",
  },
  define: {
    DEBUG: true,
  },
})
