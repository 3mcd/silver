import * as esbuild from "esbuild"
import * as path from "path"

async function build(dir: string, debug = false) {
  let pkg_dir = path.resolve(process.cwd(), dir)
  let pkg = (
    await import(path.resolve(pkg_dir, "package.json"), {
      assert: {type: "json"},
    })
  ).default

  await esbuild.build({
    absWorkingDir: pkg_dir,
    entryPoints: [pkg.source],
    outfile: debug ? pkg.exports["./debug"].import : pkg.main,
    bundle: true,
    format: "esm",
    target: "esnext",
    treeShaking: true,
    minifySyntax: true,
    external: Array.from(
      new Set([
        ...Object.keys(pkg.dependencies ?? {}),
        ...Object.keys(pkg.peerDependencies ?? {}),
      ]),
    ),
    define: {
      DEBUG: debug.toString(),
      "import.meta.vitest": "undefined",
    },
    sourcemap: debug,
  })
}

await build("libs/silver-ecs")
await build("libs/silver-ecs", true)
await build("libs/silver-net")
await build("libs/silver-net", true)
