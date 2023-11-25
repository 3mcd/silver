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
  theme: {
    extend: {
      semanticTokens: {
        colors: {
          bg: {
            default: {
              value: {base: "#f9f9f98a", _dark: "#1919198a"},
            },
            solid: {
              value: {base: "#f9f9f9", _dark: "#191919"},
            },
          },
        },
      },
    },
  },
})
