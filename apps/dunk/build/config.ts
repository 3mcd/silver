import {BuildOptions} from "esbuild"
import {parseArgs} from "util"

const {values: args} = parseArgs({
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

export const config: BuildOptions = {
  entryPoints: args.entry ? [args.entry] : ["./client.ts"],
  bundle: true,
  dropLabels: Boolean(args.optimize) ? ["DEV", "DEBUG"] : undefined,
  outdir: "dist",
  minify: Boolean(args.minify),
  mangleProps: Boolean(args.mangle) ? /_$/ : undefined,
  sourcemap: Boolean(args.sourcemap),
}
