import * as esbuild from "esbuild"
import {config} from "./config.ts"

esbuild
  .context(config)
  .then(context => context.watch())
  .catch(() => process.exit(1))
