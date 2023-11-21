import {defineConfig} from "@pandacss/dev"
import {createPreset} from "@park-ui/panda-preset"

export default defineConfig({
  preflight: true,
  presets: [
    "@pandacss/preset-base",
    createPreset({
      accentColor: "bronze",
      grayColor: "neutral",
      borderRadius: "none",
    }),
  ],
  include: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./node_modules/silver-inspector/src/**/*.{js,jsx,ts,tsx}",
  ],
  jsxFramework: "react",
  outdir: "styled-system",
})
