import {register} from "ts-node"

register({
  experimentalSpecifierResolution: "node",
})

await import("./perf")
