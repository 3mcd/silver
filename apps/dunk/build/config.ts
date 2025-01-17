import {BuildOptions} from "esbuild"
import {parseArgs} from "util"

let {values: args} = parseArgs({
  args: process.argv,
  options: {
    mangle: {
      type: "boolean",
    },
    minify: {
      type: "boolean",
    },
    sourcemap: {
      type: "boolean",
    },
    optimize: {
      type: "boolean",
    },
    entry: {
      type: "string",
    },
  },
  strict: true,
  allowPositionals: true,
})

export let config: BuildOptions = {
  entryPoints: args.entry ? [args.entry] : ["./client/index.ts"],
  bundle: true,
  dropLabels: Boolean(args.optimize) ? ["DEV", "DEBUG"] : undefined,
  outdir: "dist",
  minify: Boolean(args.minify),
  mangleProps: Boolean(args.mangle) ? /_$/ : undefined,
  sourcemap: Boolean(args.sourcemap),
}
