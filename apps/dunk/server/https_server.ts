import {readFile} from "node:fs/promises"
import {createServer} from "node:https"
import {join} from "node:path"

export let key = await readFile("./key.pem", {encoding: "utf8"})
export let cert = await readFile("./cert.pem", {encoding: "utf8"})

let mimes: Record<string, string> = {
  html: "text/html",
  wasm: "application/wasm",
  jpg: "image/jpeg",
  js: "text/javascript",
}

let asset_regex = /[^\\]*\.(\w+)$/

export let https_server = createServer({key, cert}, async (req, res) => {
  if (req.method === "GET" && req.url?.includes("/assets/")) {
    let asset_match = req.url.match(asset_regex)
    if (asset_match === null) {
      res.writeHead(404)
    } else {
      let asset_filename = asset_match[0]
      let asset_extension = asset_match[1]
      try {
        let content = await readFile(join(process.cwd(), asset_filename))
        res
          .writeHead(200, {
            "content-type": mimes[asset_extension],
          })
          .write(content)
      } catch (err) {
        console.error(err)
        res.writeHead(404)
      }
    }
  } else if (req.method === "GET" && req.url === "/dist/index.js") {
    let content = await readFile("./dist/index.js")
    res.writeHead(200, {"content-type": mimes.js}).write(content)
  } else if (req.method === "GET" && req.url === "/") {
    let content = await readFile("./index.html")
    res.writeHead(200, {"content-type": mimes.html}).write(content)
  } else {
    res.writeHead(404)
  }
  res.end()
})
