import {defineConfig, configDefaults} from "vitest/config"

export default defineConfig({
  test: {
    includeSource: ["src/**/*.{js,ts}"],
    fakeTimers: {
      toFake: [...(configDefaults.fakeTimers.toFake ?? []), "performance"],
    },
  },
})
